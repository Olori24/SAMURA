export interface AIProviderEnv {
  SAMURA_AI_PROVIDER: "ollama" | "openai";
  SAMURA_OLLAMA_BASE_URL: string;
  SAMURA_OLLAMA_MODEL: string;
  OPENAI_API_KEY?: string;
  SAMURA_OPENAI_MODEL: string;
}

export function getAIProviderConfig(env: AIProviderEnv) {
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
