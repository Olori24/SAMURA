import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests under the configured limit and rejects excess requests", () => {
    const key = "test-" + crypto.randomUUID();
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    const limited = checkRateLimit(key, 2, 60_000);
    expect(limited.allowed).toBe(false);
    expect(limited.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps limits isolated by key", () => {
    const suffix = crypto.randomUUID();
    expect(checkRateLimit("user-a-" + suffix, 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit("user-b-" + suffix, 1, 60_000).allowed).toBe(true);
  });
});
