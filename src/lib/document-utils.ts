export type DocumentFormat = "markdown" | "text";

export function safeDocumentFilename(value: string) {
  const cleaned = value.trim().toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return cleaned || "samura-document";
}

export function countWords(value: string) {
  return value.trim().match(/\S+/g)?.length ?? 0;
}

export const MAX_DOCUMENT_CHARACTERS = 200_000;
