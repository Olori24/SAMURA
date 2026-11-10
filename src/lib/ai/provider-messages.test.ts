import { describe, expect, it } from "vitest";
import { buildProviderMessages } from "./provider-messages";

describe("buildProviderMessages", () => {
  it("uses the complete code-mode instructions in both chat and regeneration", () => {
    const messages = buildProviderMessages("code", []);
    expect(messages[0].content).toContain("complete usable code");
    expect(messages[0].content).toContain("include relevant tests");
    expect(messages[0].content).toContain("Never claim code was run or tested unless it actually was");
  });

  it("bounds context from the newest messages while preserving chronological order", () => {
    const messages = buildProviderMessages("chat", [
      { role: "user", content: "first" },
      { role: "assistant", content: "second" },
      { role: "system", content: "ignore" },
    ], 8);
    expect(messages.slice(1)).toEqual([
      { role: "user", content: "st" },
      { role: "assistant", content: "second" },
    ]);
  });

  it("caps provider history at 24,000 characters by default", () => {
    const messages = buildProviderMessages("chat", [{ role: "user", content: "x".repeat(30_000) }]);
    expect(messages[1].content).toHaveLength(24_000);
  });
});
