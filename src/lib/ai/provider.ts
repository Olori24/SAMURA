import "server-only";
import { OpenAI as PostHogOpenAI } from "@posthog/ai/openai";
import OpenAI from "openai";
import { PostHog } from "posthog-node";
import { getServerEnv } from "@/lib/env";
import { getAIProviderConfig } from "@/lib/ai/provider-config";

const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!posthogProjectToken) {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
    );
  }
} else if (!posthogHost) {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
    );
  }
}

const posthog = posthogProjectToken && posthogHost
  ? new PostHog(posthogProjectToken, {
      host: posthogHost,
      enableExceptionAutocapture: true,
      flushAt: 1,
      flushInterval: 0,
      privacyMode: false,
    })
  : null;

export { getAIProviderConfig } from "@/lib/ai/provider-config";

export function createAIClient(env: ReturnType<typeof getServerEnv>) {
  const config = getAIProviderConfig(env);
  const client = posthog
    ? new PostHogOpenAI({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
        timeout: 50_000,
        maxRetries: 0,
        posthog,
      })
    : new OpenAI({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
        timeout: 50_000,
        maxRetries: 0,
      }) as unknown as PostHogOpenAI;
  return { client, posthog, provider: config.provider, model: config.model };
}

export function aiObservabilityOptions(
  ai: ReturnType<typeof createAIClient>,
  sessionId: string,
  distinctId: string,
  traceId: string,
) {
  if (!ai.posthog) return {};
  return {
    posthogDistinctId: distinctId,
    posthogTraceId: traceId,
    posthogProperties: {
      $ai_session_id: sessionId,
      $ai_provider: ai.provider,
    },
  };
}

export async function flushAIObservability(ai: ReturnType<typeof createAIClient>) {
  await ai.posthog?.flush().catch(() => undefined);
}
