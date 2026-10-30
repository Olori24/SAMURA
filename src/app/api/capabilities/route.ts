import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { buildCapabilityRegistry } from "@/lib/ai/capability-registry";
import { getAIProviderConfig } from "@/lib/ai/provider-config";
import { getImageProviderConfig } from "@/lib/ai/image-provider-config";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { isRuntimeConfigured } from "@/lib/runtime-config";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const env = getServerEnv();
    let chatConfigured = false;
    try {
      getAIProviderConfig(env);
      chatConfigured = true;
    } catch {
      // Return capability state only; never expose provider details or secrets.
    }

    const capabilities = buildCapabilityRegistry({
      runtimeConfigured: isRuntimeConfigured(),
      chatConfigured,
      imageConfigured: Boolean(getImageProviderConfig(env)),
      webSearchConfigured: Boolean(env.SAMURA_WEB_SEARCH_API_KEY || (env.GEMINI_API_KEY && env.SAMURA_GEMINI_GROUNDING_ENABLED)),
    });

    return NextResponse.json(
      { capabilities, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Capability status is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
