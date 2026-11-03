export interface ImageProviderEnv {
  SAMURA_IMAGE_API_KEY?: string;
  SAMURA_IMAGE_BASE_URL?: string;
  SAMURA_IMAGE_MODEL: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  SAMURA_GEMINI_IMAGE_MODEL?: string;
}

export function getImageProviderConfig(env: ImageProviderEnv) {
  // A legacy key is safe only for the default compatible provider endpoint.
  // Custom endpoints must have their own explicitly configured credential.
  if (env.SAMURA_IMAGE_BASE_URL) {
    if (!env.SAMURA_IMAGE_API_KEY) return null;
    return { provider: "openai_compatible" as const, apiKey: env.SAMURA_IMAGE_API_KEY, model: env.SAMURA_IMAGE_MODEL, baseURL: env.SAMURA_IMAGE_BASE_URL };
  }

  const compatibleApiKey = env.SAMURA_IMAGE_API_KEY ?? env.OPENAI_API_KEY;
  if (compatibleApiKey) {
    return { provider: "openai_compatible" as const, apiKey: compatibleApiKey, model: env.SAMURA_IMAGE_MODEL };
  }

  if (env.GEMINI_API_KEY) {
    return { provider: "gemini" as const, apiKey: env.GEMINI_API_KEY, model: env.SAMURA_GEMINI_IMAGE_MODEL ?? "gemini-nano-banana-2.1" };
  }

  return null;
}
