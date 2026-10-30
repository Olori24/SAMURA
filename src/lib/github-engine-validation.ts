import { createHash } from "node:crypto";

export function createGitHubPatchDigest(input: {
  repository: string;
  baseBranch: string;
  expectedBaseCommit: string;
  title: string;
  body: string;
  changes: Array<{ path: string; content: string; operation: "add" | "modify" }>;
}) {
  const canonical = {
    repository: input.repository.toLowerCase(),
    baseBranch: input.baseBranch,
    expectedBaseCommit: input.expectedBaseCommit,
    title: input.title,
    body: input.body,
    changes: [...input.changes].sort((a, b) => a.path.localeCompare(b.path)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function isSafeGitHubPatchPath(path: string) {
  const lower = path.toLowerCase();
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some(p => !p || p === "." || p === "..")) return false;
  if (lower === ".env" || lower.startsWith(".env.") && !lower.endsWith(".example")) return false;
  if (lower.startsWith(".github/") || lower.includes("credentials") || lower.includes("private_key")) return false;

  // Keep identity, data isolation, connector, provider, and policy enforcement
  // code outside the scope of model-generated patches.
  const protectedPrefixes = [
    "app/api/",
    "src/app/api/auth/",
    "src/app/api/capabilities/",
    "src/app/api/connectors/",
    "src/app/api/conversations/",
    "src/app/api/chat/",
    "src/app/api/documents/",
    "src/app/api/images/",
    "src/app/api/research/",
    "src/app/studio/github-engine/",
    "src/app/studio/github-publish/",
    "src/app/studio/connect/",
    "src/db/",
    "src/lib/auth",
    "src/lib/connectors/",
    "src/lib/github-engine-validation",
    "src/lib/env.",
    "src/lib/runtime-config.",
    "src/lib/distributed-rate-limit",
    "src/lib/parse-bounded-json",
    "src/lib/ai/provider",
    "src/lib/ai/image-provider-config",
    "src/proxy.",
    "src/middleware.",
  ];
  if (protectedPrefixes.some(prefix => lower.startsWith(prefix))) return false;

  const restrictedSegment = lower.split("/").some(part => ["auth", "session", "middleware", "security", "migration", "migrations"].some(name => part === name || part.startsWith(name + ".")));
  if (restrictedSegment || lower.includes("github-token") || lower.includes("db/schema")) return false;
  if (lower === "next.config.js" || lower === "next.config.ts" || lower === "next.config.mjs") return false;
  if ([".pem", ".key", ".lock", ".log", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".pdf", ".zip", ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".mp3", ".wasm", ".bin", ".svg"].some(ext => lower.endsWith(ext))) return false;
  if (lower === "package.json" || lower === "package-lock.json" || lower === "pnpm-lock.yaml" || lower === "yarn.lock") return false;
  return /^(src|app|lib|docs|test|tests)\//.test(path);
}

export function matchesExpectedBaseCommit(expected: string, actual: string) {
  return /^[0-9a-f]{40}$/i.test(expected) && /^[0-9a-f]{40}$/i.test(actual) && expected === actual;
}


export function hasExpectedGitHubPatchDigest(message: string, digest: string) {
  if (!/^[0-9a-f]{64}$/i.test(digest)) return false;
  const lines = message.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const finalLine = lines[lines.length - 1];
  return finalLine === "SAMURA-PATCH-DIGEST:" + digest;
}
