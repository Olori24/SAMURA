import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sandbox } from "@vercel/sandbox";
import { runTerminalCommand } from "./provider";

vi.mock("@vercel/sandbox", () => ({
  Sandbox: { create: vi.fn() },
}));

const mockSandbox = {
  runCommand: vi.fn(),
  stop: vi.fn(),
};

function mockCommand(stdout: string, stderr: string, exitCode: number) {
  return {
    stdout: vi.fn().mockResolvedValue(stdout),
    stderr: vi.fn().mockResolvedValue(stderr),
    exitCode,
  };
}

const config = {
  token: "test-token",
  projectId: "prj_test",
  teamId: "team_test",
};

beforeEach(() => {
  vi.mocked(Sandbox.create).mockResolvedValue(mockSandbox as never);
  mockSandbox.runCommand.mockReset();
  mockSandbox.stop.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runTerminalCommand", () => {
  it("returns BLOCKED when Vercel Sandbox authentication is unavailable", async () => {
    await expect(runTerminalCommand({ command: 'echo "TEST_OUTPUT"' }, {})).resolves.toMatchObject({
      status: "blocked",
      exitCode: null,
      stderr: expect.stringContaining("not authenticated"),
    });
    expect(Sandbox.create).not.toHaveBeenCalled();
  });

  it("rejects invalid commands without creating a sandbox", async () => {
    await expect(runTerminalCommand({ command: " " }, config)).resolves.toMatchObject({
      status: "blocked",
      exitCode: null,
    });
    expect(Sandbox.create).not.toHaveBeenCalled();
  });

  it("runs a command in a fresh network-isolated sandbox and returns real output", async () => {
    mockSandbox.runCommand.mockResolvedValue(mockCommand("TEST_OUTPUT\n", "", 0));

    await expect(runTerminalCommand({ command: 'echo "TEST_OUTPUT"', timeoutMs: 5_000 }, config)).resolves.toEqual({
      status: "complete",
      stdout: "TEST_OUTPUT\n",
      stderr: "",
      exitCode: 0,
    });

    expect(Sandbox.create).toHaveBeenCalledWith(expect.objectContaining({
      token: "test-token",
      projectId: "prj_test",
      teamId: "team_test",
      runtime: "node22",
      timeout: 10_000,
      resources: { vcpus: 1 },
      networkPolicy: "deny-all",
    }));
    expect(mockSandbox.runCommand).toHaveBeenCalledWith("bash", ["-lc", 'echo "TEST_OUTPUT"'], expect.objectContaining({ timeoutMs: 5_000 }));
    expect(mockSandbox.stop).toHaveBeenCalledOnce();
  });

  it("returns a nonzero exit code for failed commands", async () => {
    mockSandbox.runCommand.mockResolvedValue(mockCommand("", "command not found", 127));
    await expect(runTerminalCommand({ command: "unknown-command" }, config)).resolves.toMatchObject({
      status: "failed",
      stderr: "command not found",
      exitCode: 127,
    });
  });

  it("truncates oversized output", async () => {
    mockSandbox.runCommand.mockResolvedValue(mockCommand("x".repeat(20_000), "", 0));
    const result = await runTerminalCommand({ command: "echo x" }, config);
    expect(result.status).toBe("complete");
    expect(new TextEncoder().encode(result.stdout).byteLength).toBeLessThan(16_100);
    expect(result.stdout).toContain("[output truncated]");
  });

  it("does not create a sandbox if the request is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runTerminalCommand({ command: "pwd" }, { ...config, signal: controller.signal })).resolves.toMatchObject({
      status: "failed",
      stderr: "Terminal execution was cancelled.",
    });
    expect(Sandbox.create).not.toHaveBeenCalled();
  });

  it("always stops the sandbox after execution failure", async () => {
    mockSandbox.runCommand.mockRejectedValue(new Error("internal details"));
    await expect(runTerminalCommand({ command: "pwd" }, config)).resolves.toMatchObject({ status: "failed" });
    expect(mockSandbox.stop).toHaveBeenCalledOnce();
  });
});
