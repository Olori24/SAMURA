import "server-only";
import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { getAIProviderConfig } from "@/lib/ai/provider-config";

export { getAIProviderConfig } from "@/lib/ai/provider-config";

export function createAIClient(
  env: ReturnType<typeof getServerEnv>,
  selectedProvider?: ReturnType<typeof getServerEnv>["SAMURA_AI_PROVIDER"],
) {
  const config = getAIProviderConfig(env, selectedProvider);
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    timeout: 50_000,
    maxRetries: 0,
  });
  return { client, provider: config.provider, model: config.model };
}
