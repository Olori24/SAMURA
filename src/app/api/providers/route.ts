import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { isSecureOllamaBaseUrl } from "@/lib/ai/provider-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });

  const env = getServerEnv();
  const providers: Array<{ id: "ollama" | "openai" | "gemini" | "openrouter"; label: string }> = [];
  if (env.OPENROUTER_API_KEY) providers.push({ id: "openrouter", label: "OpenRouter" });
  if (env.GEMINI_API_KEY) providers.push({ id: "gemini", label: "Gemini" });
  if (env.OPENAI_API_KEY) providers.push({ id: "openai", label: "OpenAI" });

  const ollamaHost = new URL(env.SAMURA_OLLAMA_BASE_URL).hostname.toLowerCase();
  const ollamaIsLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(ollamaHost);
  const ollamaIsReachable = env.NODE_ENV !== "production" || !ollamaIsLoopback;
  if (ollamaIsReachable && isSecureOllamaBaseUrl(env.SAMURA_OLLAMA_BASE_URL)) {
    providers.push({ id: "ollama", label: "Ollama" });
  }

  const defaultProvider = providers.some(provider => provider.id === env.SAMURA_AI_PROVIDER)
    ? env.SAMURA_AI_PROVIDER
    : providers[0]?.id ?? null;
  return NextResponse.json({ providers, defaultProvider }, { headers: noStore });
}
