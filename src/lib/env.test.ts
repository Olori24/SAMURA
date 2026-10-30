import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv } from "./env";

describe("image provider endpoint transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects remote HTTP endpoints", () => {
    vi.stubEnv("SAMURA_IMAGE_BASE_URL", "http://images.example.com/v1");
    expect(() => getServerEnv()).toThrow("Image provider endpoints must use HTTPS");
  });

  it("accepts remote HTTPS endpoints", () => {
    vi.stubEnv("SAMURA_IMAGE_BASE_URL", "https://images.example.com/v1");
    expect(getServerEnv().SAMURA_IMAGE_BASE_URL).toBe("https://images.example.com/v1");
  });

  it("allows loopback HTTP endpoints for local image services", () => {
    vi.stubEnv("SAMURA_IMAGE_BASE_URL", "http://127.0.0.1:8080/v1");
    expect(getServerEnv().SAMURA_IMAGE_BASE_URL).toBe("http://127.0.0.1:8080/v1");
  });
});


describe("Gemini Search grounding opt-in", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled by default to avoid unexpected per-query charges", () => {
    expect(getServerEnv().SAMURA_GEMINI_GROUNDING_ENABLED).toBe(false);
  });

  it("enables grounding only for the explicit true value", () => {
    vi.stubEnv("SAMURA_GEMINI_GROUNDING_ENABLED", "true");
    expect(getServerEnv().SAMURA_GEMINI_GROUNDING_ENABLED).toBe(true);
    vi.stubEnv("SAMURA_GEMINI_GROUNDING_ENABLED", "false");
    expect(getServerEnv().SAMURA_GEMINI_GROUNDING_ENABLED).toBe(false);
  });
});
