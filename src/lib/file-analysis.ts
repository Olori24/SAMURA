export const MAX_FILE_ANALYSIS_CHARACTERS = 60_000;
export const MAX_FILE_ANALYSIS_BYTES = 240_000;
export const MAX_FILE_ANALYSIS_LINES = 2_000;

const supportedExtensions = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl",
  ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".xml", ".yaml",
  ".yml", ".log", ".sql", ".css", ".sh", ".toml", ".ini",
]);

export function isSupportedTextFilename(filename: string) {
  if (!filename || filename.length > 180 || /[\\/\\u0000-\\u001f]/.test(filename)) return false;
  const dot = filename.lastIndexOf(".");
  return dot > 0 && supportedExtensions.has(filename.slice(dot).toLowerCase());
}

export function validateFileAnalysisText(filename: string, content: string): string | null {
  if (!isSupportedTextFilename(filename)) return "Choose a supported text file such as TXT, Markdown, CSV, JSON, or source code.";
  if (!content.trim()) return "The selected file is empty.";
  if (content.includes("\\0")) return "This file contains binary data and cannot be analyzed as text.";
  if (content.length > MAX_FILE_ANALYSIS_CHARACTERS) return "Text files must be no larger than 60,000 characters.";
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_ANALYSIS_BYTES) return "The extracted text is too large to send safely.";
  const lineCount = content.replace(/\\r\\n?/g, "\\n").split("\\n").length;
  if (lineCount > MAX_FILE_ANALYSIS_LINES) return "Files must contain no more than 2,000 lines.";
  return null;
}

export function numberFileAnalysisLines(content: string) {
  const lines = content.replace(/\\r\\n?/g, "\\n").split("\\n");
  return {
    lineCount: lines.length,
    numberedContent: lines.map((line, index) => "[L" + (index + 1) + "] " + line).join("\\n"),
  };
}
