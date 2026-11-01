import { describe, expect, it } from "vitest";
import { getGeminiImageOutput, getSafeProviderImageUrl } from "./image-provider-image";

describe("getGeminiImageOutput", () => {
  it("reads the last image block from Gemini model_output steps", () => {
    expect(getGeminiImageOutput({
      steps: [
        { type: "user_input", content: [{ type: "text" }] },
        { type: "model_output", content: [{ type: "text" }, { type: "image", data: "first", mime_type: "image/png" }] },
        { type: "model_output", content: [{ type: "image", data: "last", mime_type: "image/webp" }] },
      ],
    })).toEqual({ data: "last", mimeType: "image/webp" });
  });

  it("uses PNG when Gemini omits the image MIME type", () => {
    expect(getGeminiImageOutput({
      steps: [{ type: "model_output", content: [{ type: "image", data: "encoded" }] }],
    })).toEqual({ data: "encoded", mimeType: "image/png" });
  });

  it("rejects missing or unsupported image output", () => {
    expect(getGeminiImageOutput({ steps: [{ type: "model_output", content: [{ type: "text", data: "text" }] }] })).toBeNull();
    expect(getGeminiImageOutput({ steps: [{ type: "model_output", content: [{ type: "image", data: "encoded", mime_type: "image/svg+xml" }] }] })).toBeNull();
  });
});

describe("getSafeProviderImageUrl", () => {
  it("accepts valid HTTPS provider URLs", () => {
    expect(getSafeProviderImageUrl("https://images.example.test/output.png?token=abc"))
      .toBe("https://images.example.test/output.png?token=abc");
  });

  it("rejects non-HTTPS URLs", () => {
    expect(getSafeProviderImageUrl("http://images.example.test/output.png")).toBeNull();
  });

  it("rejects URLs containing embedded credentials", () => {
    expect(getSafeProviderImageUrl("https://user:password@images.example.test/output.png")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(getSafeProviderImageUrl("not a URL")).toBeNull();
  });
});
