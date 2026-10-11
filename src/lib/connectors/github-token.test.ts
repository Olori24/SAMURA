import { afterEach, describe, expect, it } from "vitest";
import { decryptConnectorToken, encryptConnectorToken } from "./github-token";

const originalKey = process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY;
  else process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY = originalKey;
});

describe("GitHub connector token encryption", () => {
  it("round-trips a token without storing plaintext", () => {
    process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY = "test-only-high-entropy-key-material-123456789";
    const token = "gho_example_secret_token";
    const encrypted = encryptConnectorToken(token);
    expect(encrypted).not.toContain(token);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptConnectorToken(encrypted)).toBe(token);
  });

  it("rejects a token when the encryption key changes", () => {
    process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY = "test-only-high-entropy-key-material-123456789";
    const encrypted = encryptConnectorToken("gho_example_secret_token");
    process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY = "different-test-key-material-987654321";
    expect(() => decryptConnectorToken(encrypted)).toThrow();
  });

  it("fails closed when no encryption key is configured", () => {
    delete process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY;
    expect(() => encryptConnectorToken("token")).toThrow(/must be configured/);
  });
});
