import { describe, expect, it } from "vitest";
import { extractGeminiImageOutput } from "./gemini-image-response";

describe("extractGeminiImageOutput", () => {
  it("extracts a supported image from a model-output step", () => {
    expect(extractGeminiImageOutput({ steps: [{ type: "model_output", content: [{ type: "image", data: "base64-image", mime_type: "image/jpeg" }] }] }))
      .toEqual({ data: "base64-image", mimeType: "image/jpeg" });
  });

  it("ignores thought and tool steps and finds the first valid model image", () => {
    expect(extractGeminiImageOutput({ steps: [
      { type: "thought", content: [{ type: "image", data: "ignored" }] },
      { type: "model_output", content: [{ type: "text", text: "caption" }, { type: "image", data: "image-data" }] },
    ] })).toEqual({ data: "image-data", mimeType: "image/png" });
  });

  it("rejects missing, empty and unsupported image outputs", () => {
    expect(extractGeminiImageOutput(null)).toBeNull();
    expect(extractGeminiImageOutput({ steps: [] })).toBeNull();
    expect(extractGeminiImageOutput({ steps: [{ type: "model_output", content: [{ type: "image", data: "" }] }] })).toBeNull();
    expect(extractGeminiImageOutput({ steps: [{ type: "model_output", content: [{ type: "image", data: "x", mime_type: "image/svg+xml" }] }] })).toBeNull();
  });
});
