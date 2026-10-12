const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9])?$/;

export function isValidRepositoryName(value: string): boolean {
  if (value.length > 201 || !REPOSITORY_PATTERN.test(value)) return false;
  const [owner, repository] = value.split("/");
  return Boolean(owner && repository && !owner.includes("..") && !repository.includes(".."));
}

export function isValidRepositoryPath(value: string): boolean {
  if (!value || value.length > 500 || value.startsWith("/") || value.includes("\\\\") || /[\\u0000-\\u001f\\u007f]/.test(value)) return false;
  const segments = value.split("/");
  return segments.every(segment =>
    segment.length > 0 &&
    segment.length <= 255 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.endsWith(".") &&
    !segment.endsWith(" ")
  );
}

export function decodeGitHubText(
  base64: string,
  reportedSize: number,
  maxBytes = 200_000,
): string | null {
  if (!Number.isSafeInteger(reportedSize) || reportedSize < 0 || reportedSize > maxBytes) return null;
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64.replace(/\\s/g, ""))) return null;
  const normalized = base64.replace(/\\s/g, "");
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.byteLength !== reportedSize || bytes.byteLength > maxBytes) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function isGitHubHtmlUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password;
  } catch {
    return false;
  }
}
