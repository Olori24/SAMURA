// Keep base64 JSON requests comfortably below Vercel's 4.5 MB function body limit.
export const MAX_TRANSCRIPTION_AUDIO_BYTES = 3 * 1024 * 1024;

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/aac",
  "audio/opus",
  "audio/flac",
  "audio/aiff",
  "audio/m4a",
]);

export function normalizeAudioMimeType(value: string): string | null {
  const mimeType = value.split(";")[0]?.trim().toLowerCase();
  return mimeType && SUPPORTED_AUDIO_MIME_TYPES.has(mimeType) ? mimeType : null;
}

export function extractGeminiTranscript(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return "";

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object") continue;
    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    const transcript = parts
      .map(part => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "")
      .join("")
      .trim();
    if (transcript) return transcript;
  }

  return "";
}
