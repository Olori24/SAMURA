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
const MAX_PROVIDER_RESPONSE_BYTES = 128_000;

export type TerminalExecutionResult = {
  status: "complete" | "failed" | "blocked";
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type TerminalExecutionConfig = {
  endpoint?: string;
  token?: string;
  nodeEnv?: string;
  signal?: AbortSignal;
};

function truncate(value: string): string {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= MAX_OUTPUT_BYTES) return value;
  return new TextDecoder().decode(bytes.subarray(0, MAX_OUTPUT_BYTES)) + "\n[output truncated]";
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) {
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
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

/**
 * Calls a separately managed, isolated execution service. This Next.js app
 * deliberately does not execute shell commands in its own serverless process.
 *
 * The configured service must run each command in an ephemeral, isolated
 * workspace with no host credentials, bounded resources, and no cross-user
 * filesystem access. Its API contract is POST { command, timeoutMs,
 * outputLimitBytes } -> { stdout, stderr, exitCode }.
 */
export async function runTerminalCommand(
  input: unknown,
  config: TerminalExecutionConfig,
): Promise<TerminalExecutionResult> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "blocked", stdout: "", stderr: "Invalid command request.", exitCode: null };
  }

  if (!config.endpoint || !config.token) {
    return {
      status: "blocked",
      stdout: "",
      stderr: "Terminal execution is not connected. Configure a secured isolated execution provider before running commands.",
      exitCode: null,
    };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    return { status: "blocked", stdout: "", stderr: "Terminal execution provider URL is invalid.", exitCode: null };
  }

  const localHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(endpoint.hostname.toLowerCase());
  if (endpoint.username || endpoint.password || (endpoint.protocol !== "https:" && !(config.nodeEnv !== "production" && endpoint.protocol === "http:" && localHost))) {
    return { status: "blocked", stdout: "", stderr: "Terminal execution provider must use HTTPS in production.", exitCode: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parsed.data.timeoutMs);
  const abortFromCaller = () => controller.abort();
  config.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + config.token,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        command: parsed.data.command,
        timeoutMs: parsed.data.timeoutMs,
        outputLimitBytes: MAX_OUTPUT_BYTES,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: "failed",
        stdout: "",
        stderr: "Terminal execution provider returned HTTP " + response.status + ".",
        exitCode: null,
      };
    }

    const raw = await readBoundedJson(response);
    const result = outputSchema.safeParse(raw);
    if (!result.success) {
      return { status: "failed", stdout: "", stderr: "Terminal execution provider returned an invalid response.", exitCode: null };
    }

    return {
      status: result.data.exitCode === 0 ? "complete" : "failed",
      stdout: truncate(result.data.stdout),
      stderr: truncate(result.data.stderr),
      exitCode: result.data.exitCode,
    };
  } catch {
    const timedOut = controller.signal.aborted;
    return {
      status: "failed",
      stdout: "",
      stderr: timedOut ? "Terminal execution timed out or was cancelled." : "Terminal execution provider could not be reached.",
      exitCode: null,
    };
  } finally {
    clearTimeout(timeout);
    config.signal?.removeEventListener("abort", abortFromCaller);
  }
}
