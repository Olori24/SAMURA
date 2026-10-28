export interface ImageProviderEnv {
  SAMURA_IMAGE_API_KEY?: string;
  SAMURA_IMAGE_BASE_URL?: string;
  SAMURA_IMAGE_MODEL: string;
  OPENAI_API_KEY?: string;
}

export function getImageProviderConfig(env: ImageProviderEnv) {
  const apiKey = env.SAMURA_IMAGE_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    model: env.SAMURA_IMAGE_MODEL,
    ...(env.SAMURA_IMAGE_BASE_URL ? { baseURL: env.SAMURA_IMAGE_BASE_URL } : {}),
  };
}
