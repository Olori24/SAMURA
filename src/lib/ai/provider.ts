import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { getServerEnv } from "@/lib/env";

export type AIProviderName = "ollama" | "openai";
type ServerEnv = ReturnType<typeof getServerEnv>;

export function getAIProviderConfig(env: Pick<ServerEnv,
  "SAMURA_AI_PROVIDER" | "SAMURA_OLLAMA_BASE_URL" | "SAMURA_OLLAMA_MODEL" | "OPENAI_API_KEY" | "SAMURA_OPENAI_MODEL"
>) {
  if (env.SAMURA_AI_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OpenAI provider selected but OPENAI_API_KEY is not configured.");
    }
    return {
      provider: "openai" as const,
      model: env.SAMURA_OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      baseURL: undefined,
    };
  }

  return {
    provider: "ollama" as const,
    model: env.SAMURA_OLLAMA_MODEL,
    // Ollama's local OpenAI-compatible endpoint ignores the key. This is not a secret.
    apiKey: "ollama",
    baseURL: env.SAMURA_OLLAMA_BASE_URL,
  };
}

export function createAIClient(env: Parameters<typeof getAIProviderConfig>[0]) {
  const config = getAIProviderConfig(env);
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    timeout: 50_000,
    maxRetries: 0,
  });
  return { client, provider: config.provider, model: config.model };
}
