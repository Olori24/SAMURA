import { randomUUID } from "node:crypto";
import { z } from "zod";

const commandSchema = z.object({
  command: z.string().trim().min(1).max(2_000),
  timeoutMs: z.number().int().min(1_000).max(10_000).default(10_000),
});

const createResponseSchema = z.object({
  session: z.object({ id: z.string().min(1) }),
});

const MAX_OUTPUT_BYTES = 16_000;
const MAX_RESPONSE_BYTES = 128_000;
const VERCEL_API = "https://api.vercel.com";

export type TerminalExecutionResult = {
  status: "complete" | "failed" | "blocked";
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type TerminalExecutionConfig = {
  token?: string;
  projectId?: string;
  teamId?: string;
  signal?: AbortSignal;
};

function truncate(value: string): string {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= MAX_OUTPUT_BYTES) return value;
  return new TextDecoder().decode(bytes.subarray(0, MAX_OUTPUT_BYTES)) + "\n[output truncated]";
}

function apiUrl(path: string, teamId: string): string {
  return VERCEL_API + path + "?teamId=" + encodeURIComponent(teamId);
}

async function readBoundedText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function parseCommandOutput(text: string): { stdout: string; stderr: string; exitCode: number | null } {
  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let item: unknown;
    try {
      item = JSON.parse(line) as unknown;
    } catch {
      continue;
    }
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.data === "string" && record.stream === "stdout") stdout += record.data;
    if (typeof record.data === "string" && record.stream === "stderr") stderr += record.data;
    if (typeof record.command === "object" && record.command !== null) {
      const command = record.command as Record<string, unknown>;
      if (typeof command.exitCode === "number") exitCode = command.exitCode;
      if (typeof command.exitCode === "string" && command.exitCode.trim() !== "") exitCode = Number(command.exitCode);
    }
  }

  // Some API responses return a single JSON command object rather than ND-JSON.
  if (exitCode === null) {
    try {
      const parsed = JSON.parse(text) as { command?: { exitCode?: number | string } };
      const value = parsed.command?.exitCode;
      if (typeof value === "number") exitCode = value;
      else if (typeof value === "string" && value.trim() !== "") exitCode = Number(value);
    } catch {
      // Leave the status unknown rather than inventing a successful exit code.
    }
  }

  return { stdout, stderr, exitCode: Number.isInteger(exitCode) ? exitCode : null };
}

/**
 * Runs one command in a fresh Vercel Sandbox using the documented REST API.
 * No application environment variables are forwarded to the sandbox. The
 * sandbox has outbound networking disabled and is stopped after the command.
 */
export async function runTerminalCommand(
  input: unknown,
  config: TerminalExecutionConfig,
): Promise<TerminalExecutionResult> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "blocked", stdout: "", stderr: "Invalid command request.", exitCode: null };
  }

  if (!config.token || !config.projectId || !config.teamId) {
    return {
      status: "blocked",
      stdout: "",
      stderr: "Isolated terminal execution is not authenticated. Enable Vercel OIDC for this project or configure a server-side VERCEL_TOKEN with project and team IDs.",
      exitCode: null,
    };
  }

  if (config.signal?.aborted) {
    return { status: "failed", stdout: "", stderr: "Terminal execution was cancelled.", exitCode: null };
  }

  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  let sessionId: string | undefined;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, parsed.data.timeoutMs + 4_000);
  const abortHandler = () => {
    cancelled = true;
    controller.abort();
  };
  config.signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const createResponse = await fetch(apiUrl("/v3/sandboxes", config.teamId), {
      method: "POST",
      headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: "samura-" + randomUUID(),
        projectId: config.projectId,
        runtime: "node22",
        architecture: "amd64",
        resources: { vcpus: 1, memory: 2048 },
        timeout: parsed.data.timeoutMs + 5_000,
        persistent: false,
        networkPolicy: { mode: "deny-all" },
        env: {},
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!createResponse.ok) {
      return {
        status: "failed",
        stdout: "",
        stderr: createResponse.status === 401 || createResponse.status === 403
          ? "Vercel Sandbox authentication or project permission was denied."
          : "Vercel Sandbox could not create an isolated execution session (HTTP " + createResponse.status + ").",
        exitCode: null,
      };
    }

    const createText = await readBoundedText(createResponse);
    let createJson: unknown;
    try {
      createJson = createText === null ? null : JSON.parse(createText) as unknown;
    } catch {
      createJson = null;
    }
    const created = createResponseSchema.safeParse(createJson);
    if (!created.success) {
      return { status: "failed", stdout: "", stderr: "Vercel Sandbox returned an invalid session response.", exitCode: null };
    }
    sessionId = created.data.session.id;

    const commandResponse = await fetch(apiUrl("/v2/sandboxes/sessions/" + encodeURIComponent(sessionId) + "/cmd", config.teamId), {
      method: "POST",
      headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json", Accept: "application/x-ndjson, application/json" },
      body: JSON.stringify({
        command: "bash",
        args: ["-lc", parsed.data.command],
        cwd: "/vercel",
        env: {},
        sudo: false,
        wait: true,
        logs: true,
        timeout: parsed.data.timeoutMs,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!commandResponse.ok) {
      return {
        status: "failed",
        stdout: "",
        stderr: commandResponse.status === 401 || commandResponse.status === 403
          ? "Vercel Sandbox command execution was denied."
          : "Vercel Sandbox command failed to start (HTTP " + commandResponse.status + ").",
        exitCode: null,
      };
    }

    const commandText = await readBoundedText(commandResponse);
    if (commandText === null) {
      return { status: "failed", stdout: "", stderr: "Sandbox output was invalid or exceeded the response limit.", exitCode: null };
    }

    const result = parseCommandOutput(commandText);
    if (result.exitCode === null) {
      return { status: "failed", stdout: truncate(result.stdout), stderr: result.stderr || "Sandbox did not return a verified exit code.", exitCode: null };
    }

    return {
      status: result.exitCode === 0 ? "complete" : "failed",
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
      exitCode: result.exitCode,
    };
  } catch {
    return {
      status: "failed",
      stdout: "",
      stderr: timedOut
        ? "Terminal execution timed out."
        : cancelled || config.signal?.aborted
          ? "Terminal execution was cancelled."
          : "Vercel Sandbox execution failed. Check project authentication, sandbox availability, and usage limits.",
      exitCode: null,
    };
  } finally {
    clearTimeout(timeoutHandle);
    config.signal?.removeEventListener("abort", abortHandler);
    if (sessionId) {
      const cleanupController = new AbortController();
      const cleanupTimeout = setTimeout(() => cleanupController.abort(), 3_000);
      try {
        await fetch(apiUrl("/v2/sandboxes/sessions/" + encodeURIComponent(sessionId) + "/stop", config.teamId), {
          method: "POST",
          headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
          signal: cleanupController.signal,
          cache: "no-store",
        });
      } catch {
        // The platform also enforces the sandbox lifetime if cleanup fails.
      } finally {
        clearTimeout(cleanupTimeout);
      }
    }
  }
}
