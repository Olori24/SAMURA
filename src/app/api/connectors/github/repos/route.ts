import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { decryptConnectorToken, githubProviderId } from "@/lib/connectors/github-token";

export const runtime = "nodejs";
type GitHubUser = { login: string };
type GitHubRepo = { id: number; name: string; full_name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; updated_at: string };

export async function GET() {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const [account] = await getDb().select({ accessToken: accounts.accessToken }).from(accounts)
    .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, githubProviderId()))).limit(1);
  if (!account?.accessToken) return NextResponse.json({ error: "Connect GitHub first." }, { status: 409 });

  try {
    const token = decryptConnectorToken(account.accessToken);
    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!profileResponse.ok) return NextResponse.json({ error: "GitHub authorization expired. Reconnect your account." }, { status: profileResponse.status === 401 ? 401 : 502 });
    const profile = await profileResponse.json() as GitHubUser;
    const reposResponse = await fetch("https://api.github.com/users/" + encodeURIComponent(profile.login) + "/repos?type=owner&sort=updated&per_page=30", {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!reposResponse.ok) return NextResponse.json({ error: "Could not load public repositories." }, { status: 502 });
    const repos = await reposResponse.json() as GitHubRepo[];
    return NextResponse.json({ repositories: repos.map(repo => ({
      id: repo.id, name: repo.name, fullName: repo.full_name, url: repo.html_url, description: repo.description,
      language: repo.language, stars: repo.stargazers_count, updatedAt: repo.updated_at,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The GitHub connection could not be read securely." }, { status: 503 });
  }
}
