import "server-only";
import { OpenAI as PostHogOpenAI } from "@posthog/ai/openai";
import OpenAI from "openai";
import { PostHog } from "posthog-node";
import { getServerEnv } from "@/lib/env";
import { getAIProviderConfig } from "@/lib/ai/provider-config";

const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// PostHog is optional: missing telemetry configuration must never block AI requests.
const posthog = posthogProjectToken && posthogHost
  ? new PostHog(posthogProjectToken, {
      host: posthogHost,
      flushAt: 1,
      flushInterval: 0,
      privacyMode: true,
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
    // Enforce redaction at the individual generation call boundary.
    posthogPrivacyMode: true,
    posthogProperties: {
      $ai_session_id: sessionId,
      $ai_provider: ai.provider,
    },
  };
}

export async function flushAIObservability(ai: ReturnType<typeof createAIClient>) {
  if (!ai.posthog) return;

  // Telemetry is best-effort. Never let a slow PostHog flush delay a successful AI response.
  const flush = ai.posthog.flush().catch(() => undefined);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      flush,
      new Promise<void>(resolve => {
        timeout = setTimeout(resolve, 750);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
