import "server-only";
import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { getAIProviderConfig } from "@/lib/ai/provider-config";

export { getAIProviderConfig } from "@/lib/ai/provider-config";

export function createAIClient(env: ReturnType<typeof getServerEnv>) {
  const config = getAIProviderConfig(env);
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    timeout: 50_000,
    maxRetries: 0,
  });
  return { client, provider: config.provider, model: config.model };
}
