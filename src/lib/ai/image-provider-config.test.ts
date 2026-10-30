import { describe, expect, it } from "vitest";
import { getImageProviderConfig } from "./image-provider-config";

describe("image provider configuration", () => {
  it("returns no configuration when no server-side image key is available", () => {
    expect(getImageProviderConfig({ SAMURA_IMAGE_MODEL: "image-model" })).toBeNull();
  });

  it("uses the explicit image key and configured compatible endpoint", () => {
    expect(getImageProviderConfig({
      SAMURA_IMAGE_API_KEY: "test-secret",
      SAMURA_IMAGE_BASE_URL: "https://images.example.test/v1",
      SAMURA_IMAGE_MODEL: "image-model",
    })).toEqual({
      apiKey: "test-secret",
      baseURL: "https://images.example.test/v1",
      model: "image-model",
    });
  });

  it("does not reuse a legacy key with a custom endpoint", () => {
    expect(getImageProviderConfig({
      OPENAI_API_KEY: "legacy-secret",
      SAMURA_IMAGE_BASE_URL: "https://images.example.test/v1",
      SAMURA_IMAGE_MODEL: "image-model",
    })).toBeNull();
  });

  it("supports the legacy key only for the default endpoint during migration", () => {
    expect(getImageProviderConfig({
      OPENAI_API_KEY: "legacy-secret",
      SAMURA_IMAGE_MODEL: "gpt-image-1",
    })).toEqual({
      apiKey: "legacy-secret",
      model: "gpt-image-1",
    });
  });
});
