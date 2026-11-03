export const MAX_FILE_ANALYSIS_CHARACTERS = 60_000;
export const MAX_FILE_ANALYSIS_BYTES = 240_000;
export const MAX_FILE_ANALYSIS_LINES = 2_000;

const supportedExtensions = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl",
  ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".xml", ".yaml",
  ".yml", ".log", ".sql", ".css", ".sh", ".toml", ".ini",
]);

export function isSupportedTextFilename(filename: string) {
  if (!filename || filename.length > 180 || filename.includes("/") || filename.includes(String.fromCharCode(92)) || [...filename].some(char => char.charCodeAt(0) < 32)) return false;
  const dot = filename.lastIndexOf(".");
  return dot > 0 && supportedExtensions.has(filename.slice(dot).toLowerCase());
}

function normalizeFileLineEndings(content: string) {
  const carriageReturn = String.fromCharCode(13);
  const lineFeed = String.fromCharCode(10);
  return content.split(carriageReturn + lineFeed).join(lineFeed).split(carriageReturn).join(lineFeed);
}
export function validateFileAnalysisText(filename: string, content: string): string | null {
  if (!isSupportedTextFilename(filename)) return "Choose a supported text file such as TXT, Markdown, CSV, JSON, or source code.";
  if (!content.trim()) return "The selected file is empty.";
  if (content.includes(String.fromCharCode(0))) return "This file contains binary data and cannot be analyzed as text.";
  if (content.length > MAX_FILE_ANALYSIS_CHARACTERS) return "Text files must be no larger than 60,000 characters.";
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_ANALYSIS_BYTES) return "The extracted text is too large to send safely.";
  const lineCount = normalizeFileLineEndings(content).split(String.fromCharCode(10)).length;
  if (lineCount > MAX_FILE_ANALYSIS_LINES) return "Files must contain no more than 2,000 lines.";
  return null;
}

export function numberFileAnalysisLines(content: string) {
  const lines = normalizeFileLineEndings(content).split(String.fromCharCode(10));
  return {
    lineCount: lines.length,
    numberedContent: lines.map((line, index) => "[L" + (index + 1) + "] " + line).join(String.fromCharCode(10)),
  };
}

export function validateFileAnalysisCitations(answer: string, lineCount: number) {
  let output = "";
  let cursor = 0;
  while (cursor < answer.length) {
    const markerStart = answer.indexOf("[L", cursor);
    if (markerStart < 0) break;
    const markerEnd = answer.indexOf("]", markerStart + 2);
    if (markerEnd < 0) break;
    const marker = answer.slice(markerStart, markerEnd + 1);
    const parts = answer.slice(markerStart + 2, markerEnd).split("-L");
    const startText = parts[0] ?? "";
    const endText = parts.length === 2 ? parts[1] : startText;
    const startLine = Number(startText);
    const endLine = Number(endText);
    const valid = parts.length <= 2
      && startText.length > 0
      && endText.length > 0
      && String(startLine) === startText
      && String(endLine) === endText
      && startLine >= 1
      && endLine >= startLine
      && endLine <= lineCount;
    output += answer.slice(cursor, markerStart) + (valid ? marker : "[unverified line reference]");
    cursor = markerEnd + 1;
  }
  return output + answer.slice(cursor);
}
