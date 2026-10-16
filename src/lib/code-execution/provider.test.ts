import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTerminalCommand } from "./provider";

const config = { token: "test-token", projectId: "prj_test", teamId: "team_test" };

function ndjson(stdout: string, stderr: string, exitCode: number) {
  return [
    JSON.stringify({ data: stdout, stream: "stdout" }),
    JSON.stringify({ data: stderr, stream: "stderr" }),
    JSON.stringify({ command: { exitCode } }),
    "",
  ].join("\n");
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runTerminalCommand", () => {
  it("returns BLOCKED when Vercel Sandbox authentication is unavailable", async () => {
    await expect(runTerminalCommand({ command: 'echo "TEST_OUTPUT"' }, {})).resolves.toMatchObject({
      status: "blocked",
      exitCode: null,
      stderr: expect.stringContaining("not authenticated"),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid commands without creating a sandbox", async () => {
    await expect(runTerminalCommand({ command: " " }, config)).resolves.toMatchObject({
      status: "blocked",
      exitCode: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates a network-isolated sandbox, returns real output, and stops the session", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "sbx_test" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(ndjson("TEST_OUTPUT\n", "", 0), { status: 200, headers: { "Content-Type": "application/x-ndjson" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "sbx_test", status: "stopped" } }), { status: 200 }));

    await expect(runTerminalCommand({ command: 'echo "TEST_OUTPUT"', timeoutMs: 5_000 }, config)).resolves.toEqual({
      status: "complete",
      stdout: "TEST_OUTPUT\n",
      stderr: "",
      exitCode: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [createUrl, createInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(createUrl).toContain("/v3/sandboxes?teamId=team_test");
    expect((createInit.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(JSON.parse(String(createInit.body))).toMatchObject({
      projectId: "prj_test",
      resources: { vcpus: 1, memory: 2048 },
      timeout: 10_000,
      persistent: false,
      networkPolicy: { mode: "deny-all" },
      env: {},
    });
    const [commandUrl, commandInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(commandUrl).toContain("/v2/sandboxes/sessions/sbx_test/cmd?teamId=team_test");
    expect(JSON.parse(String(commandInit.body))).toMatchObject({
      command: "bash",
      args: ["-lc", 'echo "TEST_OUTPUT"'],
      sudo: false,
      wait: true,
      logs: true,
      timeout: 5_000,
      env: {},
    });
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/v2/sandboxes/sessions/sbx_test/stop?teamId=team_test");
  });

  it("returns a nonzero exit code for failed commands", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "sbx_test" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(ndjson("", "command not found", 127), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(runTerminalCommand({ command: "unknown-command" }, config)).resolves.toMatchObject({
      status: "failed",
      stderr: "command not found",
      exitCode: 127,
    });
  });

  it("truncates oversized output", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "sbx_test" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(ndjson("x".repeat(20_000), "", 0), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const result = await runTerminalCommand({ command: "echo x" }, config);
    expect(result.status).toBe("complete");
    expect(new TextEncoder().encode(result.stdout).byteLength).toBeLessThan(16_100);
    expect(result.stdout).toContain("[output truncated]");
  });

  it("reports provider authorization errors without leaking response bodies", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("secret response body", { status: 403 }));
    await expect(runTerminalCommand({ command: "pwd" }, config)).resolves.toMatchObject({
      status: "failed",
      stderr: "Vercel Sandbox authentication or project permission was denied.",
    });
  });

  it("does not create a sandbox if the request is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runTerminalCommand({ command: "pwd" }, { ...config, signal: controller.signal })).resolves.toMatchObject({
      status: "failed",
      stderr: "Terminal execution was cancelled.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops the sandbox after command failure", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "sbx_test" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response("internal failure", { status: 500 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(runTerminalCommand({ command: "pwd" }, config)).resolves.toMatchObject({ status: "failed" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
