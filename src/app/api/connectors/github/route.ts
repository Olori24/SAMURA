import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { decryptConnectorToken, githubProviderId } from "@/lib/connectors/github-token";

export const runtime = "nodejs";
type GitHubUser = { login: string; name: string | null; avatar_url: string; html_url: string };

async function getAccount() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const [account] = await getDb().select({
    id: accounts.id, accessToken: accounts.accessToken, scope: accounts.scope,
  }).from(accounts).where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, githubProviderId()))).limit(1);
  return { user: session.user, account };
}

export async function GET() {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });
  const result = await getAccount();
  if ("response" in result) return result.response;
  if (!result.account?.accessToken) return NextResponse.json({ connected: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const token = decryptConnectorToken(result.account.accessToken);
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) return NextResponse.json({ connected: true, needsReauthorization: true }, { headers: { "Cache-Control": "no-store" } });
    if (!response.ok) return NextResponse.json({ error: "GitHub could not verify the connection." }, { status: 502 });
    const profile = await response.json() as GitHubUser;
    return NextResponse.json({
      connected: true, account: { login: profile.login, name: profile.name, avatarUrl: profile.avatar_url, profileUrl: profile.html_url },
      scopes: result.account.scope?.split(" ").filter(Boolean) ?? [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The GitHub connection could not be read securely." }, { status: 503 });
  }
}

export async function DELETE() {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });
  const result = await getAccount();
  if ("response" in result) return result.response;
  if (!result.account) return NextResponse.json({ connected: false }, { headers: { "Cache-Control": "no-store" } });

  const clientId = process.env.GITHUB_CLIENT_ID, clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (clientId && clientSecret && result.account.accessToken) {
    try {
      const token = decryptConnectorToken(result.account.accessToken);
      await fetch("https://api.github.com/applications/" + encodeURIComponent(clientId) + "/grant", {
        method: "DELETE",
        headers: {
          Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
          Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: token }), cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
    } catch { /* Remove the local credential even if remote revocation is unavailable. */ }
  }
  await getDb().delete(accounts).where(and(eq(accounts.userId, result.user.id), eq(accounts.providerId, githubProviderId())));
  return NextResponse.json({ connected: false, revoked: true }, { headers: { "Cache-Control": "no-store" } });
}
