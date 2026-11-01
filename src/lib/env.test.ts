import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv } from "./env";

describe("image provider environment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts an HTTPS image provider endpoint", () => {
    vi.stubEnv("SAMURA_IMAGE_BASE_URL", "https://images.example.test/v1");
    expect(getServerEnv().SAMURA_IMAGE_BASE_URL).toBe("https://images.example.test/v1");
  });

  it("rejects remote HTTP image provider endpoints", () => {
    vi.stubEnv("SAMURA_IMAGE_BASE_URL", "http://images.example.test/v1");
    expect(() => getServerEnv()).toThrow("Image provider endpoints must use HTTPS");
  });

  it("allows loopback HTTP endpoints for local image services", () => {
    vi.stubEnv("SAMURA_IMAGE_BASE_URL", "http://127.0.0.1:8080/v1");
    expect(getServerEnv().SAMURA_IMAGE_BASE_URL).toBe("http://127.0.0.1:8080/v1");
  });

  it("provides a Gemini image model default without exposing credentials", () => {
    vi.stubEnv("SAMURA_IMAGE_BASE_URL", "");
    expect(getServerEnv().SAMURA_GEMINI_IMAGE_MODEL).toBe("gemini-nano-banana-2.1");
  });
});
