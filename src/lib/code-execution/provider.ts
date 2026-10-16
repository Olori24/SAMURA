import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";

const commandSchema = z.object({
  command: z.string().trim().min(1).max(2_000),
  timeoutMs: z.number().int().min(1_000).max(10_000).default(10_000),
});

const outputSchema = z.object({
  stdout: z.string().optional().default(""),
  stderr: z.string().optional().default(""),
  exitCode: z.number().int(),
});

const MAX_OUTPUT_BYTES = 16_000;

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

function abortedError(): Error {
  return new Error("Terminal execution was cancelled.");
}

/**
 * Runs a command in a fresh Vercel Sandbox, never in the SAMURA web process.
 * Sandboxes have outbound networking disabled, no application environment
 * variables are forwarded, and the instance is stopped after one command.
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

  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  let timedOut = false;
  let cancelled = false;

  try {
    sandbox = await Sandbox.create({
      token: config.token,
      projectId: config.projectId,
      teamId: config.teamId,
      runtime: "node22",
      timeout: parsed.data.timeoutMs + 5_000,
      resources: { vcpus: 1 },
      networkPolicy: "deny-all",
    });

    const commandController = new AbortController();
    abortHandler = () => {
      cancelled = true;
      commandController.abort();
    };
    config.signal?.addEventListener("abort", abortHandler, { once: true });
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      commandController.abort();
    }, parsed.data.timeoutMs);

    const command = await sandbox.runCommand(
      "bash",
      ["-lc", parsed.data.command],
      { timeoutMs: parsed.data.timeoutMs, signal: commandController.signal },
    );
    const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
    const result = { stdout, stderr, exitCode: command.exitCode ?? 1 };
    const validated = outputSchema.safeParse(result);
    if (!validated.success) {
      return { status: "failed", stdout: "", stderr: "Sandbox returned an invalid result.", exitCode: null };
    }

    return {
      status: validated.data.exitCode === 0 ? "complete" : "failed",
      stdout: truncate(validated.data.stdout),
      stderr: truncate(validated.data.stderr),
      exitCode: validated.data.exitCode,
    };
  } catch {
    return {
      status: "failed",
      stdout: "",
      stderr: timedOut
        ? "Terminal execution timed out."
        : cancelled || config.signal?.aborted
          ? "Terminal execution was cancelled."
          : "Isolated terminal execution failed. Check sandbox availability and authentication.",
      exitCode: null,
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (abortHandler) config.signal?.removeEventListener("abort", abortHandler);
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Best-effort cleanup; the sandbox has a server-enforced lifetime.
      }
    }
  }
}
