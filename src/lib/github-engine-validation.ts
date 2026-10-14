export function isSafeGitHubPatchPath(path: string) {
  const lower = path.toLowerCase();
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some(p => !p || p === "." || p === "..")) return false;
  if (lower === ".env" || lower.startsWith(".env.") && !lower.endsWith(".example")) return false;
  if (lower.startsWith(".github/") || lower.includes("credentials") || lower.includes("private_key")) return false;
  const restrictedSegment = lower.split("/").some(part => ["auth", "session", "middleware", "security", "migration", "migrations"].some(name => part === name || part.startsWith(name + ".")));
  if (restrictedSegment || lower.includes("github-token") || lower.includes("db/schema")) return false;
  if (lower === "next.config.js" || lower === "next.config.ts" || lower === "next.config.mjs") return false;
  if (lower.endsWith(".pem") || lower.endsWith(".key") || lower.endsWith(".lock") || lower.endsWith(".log")) return false;
  if (lower === "package.json" || lower === "package-lock.json" || lower === "pnpm-lock.yaml" || lower === "yarn.lock") return false;
  return /^(src|app|lib|docs|test|tests)\//.test(path);
}
