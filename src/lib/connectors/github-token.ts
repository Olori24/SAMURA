import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PROVIDER_ID = "samura-github";
const MAX_TOKEN_CHARS = 8_192;
const MAX_ENVELOPE_CHARS = 16_384;

export function githubProviderId() {
  return PROVIDER_ID;
}

function encryptionKey() {
  const configured = process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY;
  if (!configured || configured.length < 32) {
    throw new Error("SAMURA_CONNECTOR_ENCRYPTION_KEY must be configured with a high-entropy secret.");
  }
  return createHash("sha256").update(configured, "utf8").digest();
}

export function encryptConnectorToken(token: string) {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_CHARS) {
    throw new Error("GitHub connector token is empty or exceeds the supported size.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decodeBase64UrlPart(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Stored connector token has invalid encoding.");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new Error("Stored connector token has non-canonical encoding.");
  }
  return decoded;
}

export function decryptConnectorToken(value: string) {
  if (typeof value !== "string" || value.length > MAX_ENVELOPE_CHARS) {
    throw new Error("Stored connector token exceeds the supported size.");
  }
  const parts = value.split(".");
  if (parts.length !== 4) {
    throw new Error("Stored connector token has an unsupported format.");
  }
  const [version, ivText, tagText, ciphertextText] = parts;
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) {
    throw new Error("Stored connector token has an unsupported format.");
  }

  const iv = decodeBase64UrlPart(ivText);
  const tag = decodeBase64UrlPart(tagText);
  const ciphertext = decodeBase64UrlPart(ciphertextText);
  if (iv.byteLength !== 12 || tag.byteLength !== 16 || ciphertext.byteLength === 0 || ciphertext.byteLength > MAX_TOKEN_CHARS) {
    throw new Error("Stored connector token has invalid lengths.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
