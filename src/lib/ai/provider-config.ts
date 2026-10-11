export interface AIProviderEnv {
  SAMURA_AI_PROVIDER: "ollama" | "openai" | "gemini";
  SAMURA_OLLAMA_BASE_URL: string;
  SAMURA_OLLAMA_MODEL: string;
  OPENAI_API_KEY?: string;
  SAMURA_OPENAI_MODEL: string;
  GEMINI_API_KEY?: string;
  SAMURA_GEMINI_MODEL: string;
  NODE_ENV?: string;
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

  if (env.SAMURA_AI_PROVIDER === "gemini") {
    if (!env.GEMINI_API_KEY) {
      throw new Error("Gemini provider selected but GEMINI_API_KEY is not configured.");
    }
    return {
      provider: "gemini" as const,
      model: env.SAMURA_GEMINI_MODEL,
      apiKey: env.GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    };
  }

  if (env.NODE_ENV === "production") {
    const host = new URL(env.SAMURA_OLLAMA_BASE_URL).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
      throw new Error("Ollama is configured for localhost in production; configure a reachable, secured Ollama endpoint.");
    }
  }

  return {
    provider: "ollama" as const,
    model: env.SAMURA_OLLAMA_MODEL,
    // Ollama's local OpenAI-compatible endpoint ignores the key. This is not a secret.
    apiKey: "ollama",
    baseURL: env.SAMURA_OLLAMA_BASE_URL,
  };
}
