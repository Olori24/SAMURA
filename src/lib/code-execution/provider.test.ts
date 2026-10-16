import { afterEach, describe, expect, it, vi } from "vitest";
import { runTerminalCommand } from "./provider";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runTerminalCommand", () => {
  it("returns BLOCKED when no execution provider is configured", async () => {
    await expect(runTerminalCommand({ command: 'echo "TEST_OUTPUT"' }, {})).resolves.toMatchObject({
      status: "blocked",
      exitCode: null,
      stderr: expect.stringContaining("not connected"),
    });
  });

  it("rejects an invalid command without calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(runTerminalCommand({ command: " " }, {
      endpoint: "https://sandbox.example.test/execute",
      token: "test-token",
      nodeEnv: "production",
    })).resolves.toMatchObject({ status: "blocked", exitCode: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a bounded command to the configured HTTPS provider and returns actual output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      stdout: "TEST_OUTPUT\n",
      stderr: "",
      exitCode: 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runTerminalCommand({ command: 'echo "TEST_OUTPUT"', timeoutMs: 5_000 }, {
      endpoint: "https://sandbox.example.test/execute",
      token: "test-token",
      nodeEnv: "production",
    })).resolves.toEqual({
      status: "complete",
      stdout: "TEST_OUTPUT\n",
      stderr: "",
      exitCode: 0,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://sandbox.example.test/execute");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(JSON.parse(String(init.body))).toEqual({
      command: 'echo "TEST_OUTPUT"',
      timeoutMs: 5_000,
      outputLimitBytes: 16_000,
    });
  });

  it("refuses non-HTTPS providers in production", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(runTerminalCommand({ command: "pwd" }, {
      endpoint: "http://sandbox.example.test/execute",
      token: "test-token",
      nodeEnv: "production",
    })).resolves.toMatchObject({ status: "blocked", exitCode: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds returned output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      stdout: "x".repeat(20_000),
      stderr: "",
      exitCode: 0,
    }), { status: 200 })));
    const result = await runTerminalCommand({ command: "echo x" }, {
      endpoint: "https://sandbox.example.test/execute",
      token: "test-token",
      nodeEnv: "production",
    });
    expect(result.status).toBe("complete");
    expect(result.stdout.length).toBeLessThan(16_100);
    expect(result.stdout).toContain("[output truncated]");
  });
});
