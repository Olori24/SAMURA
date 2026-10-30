export function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (!raw.trim()) return "Unknown error";
  const safe = raw
    .replace(/https?:\\/\\/[^\\s"'<>]+/gi, "[url]")
    .replace(/\\b(?:Bearer|Basic)\\s+[A-Za-z0-9._~+/-]+=*/gi, "[redacted]")
    .replace(/\\b(?:sk|rk|pk|phc|ghp|github_pat)[-_][A-Za-z0-9_-]{8,}\\b/gi, "[redacted]")
    .replace(/\\b[A-Za-z0-9_-]{40,}\\b/g, "[redacted]")
    .slice(0, 200)
    .trim();
  return safe || "Unknown error";
}
