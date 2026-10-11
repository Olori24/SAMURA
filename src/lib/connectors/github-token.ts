import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PROVIDER_ID = "samura-github";

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
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptConnectorToken(value: string) {
  const [version, ivText, tagText, ciphertextText] = value.split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) {
    throw new Error("Stored connector token has an unsupported format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
