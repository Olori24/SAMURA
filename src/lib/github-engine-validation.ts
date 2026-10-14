import { createHash } from "node:crypto";

export function createGitHubPatchDigest(input: {
  repository: string;
  baseBranch: string;
  title: string;
  body: string;
  changes: Array<{ path: string; content: string; operation: "add" | "modify" }>;
}) {
  // Sort changes so the digest represents patch meaning, not UI array ordering.
  const canonical = {
    repository: input.repository.toLowerCase(),
    baseBranch: input.baseBranch,
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
  const restrictedSegment = lower.split("/").some(part => ["auth", "session", "middleware", "security", "migration", "migrations"].some(name => part === name || part.startsWith(name + ".")));
  if (restrictedSegment || lower.includes("github-token") || lower.includes("db/schema")) return false;
  if (lower === "next.config.js" || lower === "next.config.ts" || lower === "next.config.mjs") return false;
  if ([".pem", ".key", ".lock", ".log", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".pdf", ".zip", ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".mp3", ".wasm", ".bin", ".svg"].some(ext => lower.endsWith(ext))) return false;
  if (lower === "package.json" || lower === "package-lock.json" || lower === "pnpm-lock.yaml" || lower === "yarn.lock") return false;
  return /^(src|app|lib|docs|test|tests)\//.test(path);
}


/** A publish request is valid only for the exact commit inspected and reviewed by the user. */
export function matchesExpectedBaseCommit(expected: string, actual: string) {
  return /^[0-9a-f]{40}$/i.test(expected) && /^[0-9a-f]{40}$/i.test(actual) && expected === actual;
}
