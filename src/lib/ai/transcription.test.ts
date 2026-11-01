import { describe, expect, it } from "vitest";
import { extractGeminiTranscript, normalizeAudioMimeType } from "./transcription";

describe("voice transcription helpers", () => {
  it("normalizes MediaRecorder MIME parameters", () => {
    expect(normalizeAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
  });

  it("maps Safari MediaRecorder MP4 audio to Gemini's supported M4A MIME type", () => {
    expect(normalizeAudioMimeType("audio/mp4")).toBe("audio/m4a");
    expect(normalizeAudioMimeType("audio/mp4;codecs=mp4a.40.2")).toBe("audio/m4a");
  });

  it("rejects unsupported audio MIME types", () => {
    expect(normalizeAudioMimeType("application/octet-stream")).toBeNull();
    expect(normalizeAudioMimeType("text/plain")).toBeNull();
  });

  it("extracts only text parts from the first usable Gemini candidate", () => {
    expect(extractGeminiTranscript({
      candidates: [
        { content: { parts: [{ text: "Hello " }, { inlineData: { mimeType: "audio/webm", data: "ignored" } }, { text: "there." }] } },
      ],
    })).toBe("Hello there.");
  });

  it("returns an empty transcript for malformed or empty provider responses", () => {
    expect(extractGeminiTranscript(null)).toBe("");
    expect(extractGeminiTranscript({ candidates: [] })).toBe("");
    expect(extractGeminiTranscript({ candidates: [{ content: { parts: [] } }] })).toBe("");
  });
});
