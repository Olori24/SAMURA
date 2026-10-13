import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./security-policy";

describe("buildContentSecurityPolicy", () => {
  it("allows the request nonce without enabling inline script execution", () => {
    const nonce = "QWxwaGFCZXRhR2FtbWFEZWx0YVNlY3VyZQ==";
    const policy = buildContentSecurityPolicy(nonce);
    const scriptPolicy = policy.split("; ").find((item) => item.startsWith("script-src"));

    expect(scriptPolicy).toContain(`'nonce-${nonce}'`);
    expect(scriptPolicy).toContain("'strict-dynamic'");
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(scriptPolicy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it("rejects short or malformed nonces", () => {
    expect(() => buildContentSecurityPolicy("short")).toThrow(/nonce/i);
    expect(() => buildContentSecurityPolicy("not a nonce with spaces")).toThrow(/nonce/i);
  });
});
