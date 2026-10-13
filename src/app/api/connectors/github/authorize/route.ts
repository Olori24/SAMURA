import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return NextResponse.redirect(new URL("/login", request.url));
  const rate = await checkDistributedRateLimit("github-oauth-start:" + session.user.id, 5, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!rate.allowed) return NextResponse.json({ error: "Too many GitHub connection attempts. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } });

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const encryptionKey = process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY;
  const callbackUrl = process.env.BETTER_AUTH_URL
    ? new URL("/api/connectors/github/callback", process.env.BETTER_AUTH_URL).toString()
    : "https://samura-ai.vercel.app/api/connectors/github/callback";
  if (!clientId || !clientSecret || !encryptionKey || encryptionKey.length < 32) {
    return NextResponse.redirect(new URL("/studio/connect?github=setup_required", request.url));
  }

  const state = randomBytes(32).toString("hex");
  const response = NextResponse.redirect(
    "https://github.com/login/oauth/authorize?" + new URLSearchParams({
      client_id: clientId, redirect_uri: callbackUrl, scope: "read:user user:email", state, allow_signup: "false",
    }).toString(),
  );
  response.cookies.set("samura_github_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/api/connectors/github", maxAge: 600,
  });
  return response;
}
