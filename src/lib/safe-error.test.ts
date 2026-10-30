import { describe, expect, it } from "vitest";
import { safeErrorMessage } from "./safe-error";

describe("safeErrorMessage", () => {
  it("redacts URLs and common credential formats", () => {
    const value = safeErrorMessage(new Error("request failed https://provider.example/v1?api_key=secret Bearer abcdefghijklmnopqrstuvwxyz sk-proj-12345678901234567890"));
    expect(value).not.toContain("https://");
    expect(value).not.toContain("secret");
    expect(value).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(value).not.toContain("sk-proj-");
    expect(value).toContain("[redacted]");
  });

  it("bounds messages and provides a safe fallback", () => {
    expect(safeErrorMessage(new Error("provider error ".repeat(30)))).toHaveLength(200);
    expect(safeErrorMessage("not an Error")).toBe("Unknown error");
  });
});
