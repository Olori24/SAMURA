import { describe, expect, it } from "vitest";
import { getAIProviderConfig } from "./provider-config";

const base = {
  SAMURA_AI_PROVIDER: "ollama" as const,
  SAMURA_OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1",
  SAMURA_OLLAMA_MODEL: "qwen3:8b",
  SAMURA_OPENAI_MODEL: "gpt-4.1-mini",
  SAMURA_GEMINI_MODEL: "gemini-3.8-flash",
};

describe("SAMURA AI provider configuration", () => {
  it("selects local Ollama without requiring an OpenAI API key", () => {
    expect(getAIProviderConfig(base)).toEqual({
      provider: "ollama",
      model: "qwen3:8b",
      apiKey: "ollama",
      baseURL: "http://127.0.0.1:11434/v1",
    });
  });

  it("requires a Gemini key only when Gemini is explicitly selected", () => {
    expect(() => getAIProviderConfig({
      ...base,
      SAMURA_AI_PROVIDER: "gemini",
    })).toThrow("GEMINI_API_KEY");
  });

  it("configures Gemini through its OpenAI-compatible endpoint", () => {
    expect(getAIProviderConfig({
      ...base,
      SAMURA_AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-gemini-key",
    })).toEqual({
      provider: "gemini",
      model: "gemini-3.8-flash",
      apiKey: "test-gemini-key",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  });

  it("rejects a localhost Ollama endpoint in production", () => {
    expect(() => getAIProviderConfig({
      ...base,
      NODE_ENV: "production",
    })).toThrow("localhost in production");
  });

  it("allows a non-local Ollama endpoint in production", () => {
    expect(getAIProviderConfig({
      ...base,
      NODE_ENV: "production",
      SAMURA_OLLAMA_BASE_URL: "https://ollama.internal.example/v1",
    }).provider).toBe("ollama");
  });

  it("requires a key only when OpenAI is explicitly selected", () => {
    expect(() => getAIProviderConfig({
      ...base,
      SAMURA_AI_PROVIDER: "openai",
    })).toThrow("OPENAI_API_KEY");
  });

  it("configures OpenAI when explicitly selected and a key is provided", () => {
    expect(getAIProviderConfig({
      ...base,
      SAMURA_AI_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    })).toEqual({
      provider: "openai",
      model: "gpt-4.1-mini",
      apiKey: "test-key",
      baseURL: undefined,
    });
  });
});
