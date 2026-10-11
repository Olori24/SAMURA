import { randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { encryptConnectorToken, githubProviderId } from "@/lib/connectors/github-token";

export const runtime = "nodejs";
type GitHubTokenResponse = { access_token?: string; scope?: string; error?: string };
type GitHubUser = { id: number; login: string };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set("samura_github_oauth_state", "", {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/api/connectors/github", maxAge: 0,
    });
    return response;
  };
  const fail = (reason: string) => clearStateCookie(NextResponse.redirect(
    new URL("/studio/connect?github=" + encodeURIComponent(reason), url.origin),
  ));
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });

  const state = url.searchParams.get("state") ?? "";
  const cookieState = request.headers.get("cookie")?.split(";").map(v => v.trim())
    .find(v => v.startsWith("samura_github_oauth_state="))?.slice("samura_github_oauth_state=".length) ?? "";
  const validState = state.length === 64 && cookieState.length === 64
    && timingSafeEqual(Buffer.from(state), Buffer.from(cookieState));
  if (!validState) return fail("invalid_state");
  if (url.searchParams.has("error")) return fail("cancelled");

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return clearStateCookie(NextResponse.redirect(new URL("/login", url.origin)));
  const code = url.searchParams.get("code");
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret || !process.env.SAMURA_CONNECTOR_ENCRYPTION_KEY) return fail("setup_required");

  try {
    const callbackUrl = process.env.BETTER_AUTH_URL
      ? new URL("/api/connectors/github/callback", process.env.BETTER_AUTH_URL).toString()
      : "https://samura-ai.vercel.app/api/connectors/github/callback";
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    if (!tokenResponse.ok) return fail("token_exchange_failed");
    const tokenData = await tokenResponse.json() as GitHubTokenResponse;
    if (!tokenData.access_token || tokenData.error) return fail("token_exchange_failed");

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + tokenData.access_token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    if (!profileResponse.ok) return fail("profile_fetch_failed");
    const profile = await profileResponse.json() as GitHubUser;
    if (!Number.isSafeInteger(profile.id) || !profile.login) return fail("profile_fetch_failed");

    const db = getDb(), providerId = githubProviderId(), now = new Date();
    const [existing] = await db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, providerId))).limit(1);
    const encrypted = encryptConnectorToken(tokenData.access_token);
    if (existing) {
      await db.update(accounts).set({
        accountId: String(profile.id), accessToken: encrypted, refreshToken: null,
        scope: tokenData.scope ?? "read:user user:email", updatedAt: now,
      }).where(and(eq(accounts.id, existing.id), eq(accounts.userId, session.user.id)));
    } else {
      await db.insert(accounts).values({
        id: randomUUID(), accountId: String(profile.id), providerId, userId: session.user.id,
        accessToken: encrypted, scope: tokenData.scope ?? "read:user user:email", createdAt: now, updatedAt: now,
      });
    }
    return clearStateCookie(NextResponse.redirect(new URL("/studio/connect?github=connected", url.origin)));
  } catch {
    return fail("connection_failed");
  }
}
