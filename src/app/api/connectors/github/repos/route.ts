import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { decryptConnectorToken, githubProviderId } from "@/lib/connectors/github-token";

export const runtime = "nodejs";
type GitHubProfile = { login: string; name: string | null; avatar_url: string; html_url: string };
type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  private: boolean;
  default_branch: string;
  permissions?: { pull?: boolean; push?: boolean; admin?: boolean };
};

const noStore = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie" };

export async function GET() {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503, headers: noStore });
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });
  const [account] = await getDb().select({ accessToken: accounts.accessToken, scope: accounts.scope }).from(accounts)
    .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, githubProviderId()))).limit(1);
  if (!account?.accessToken) return NextResponse.json({ error: "Connect GitHub first." }, { status: 409, headers: noStore });

  try {
    const token = decryptConnectorToken(account.accessToken);
    const headers = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const profileResponse = await fetch("https://api.github.com/user", {
      headers, cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (profileResponse.status === 401) {
      return NextResponse.json({ error: "GitHub authorization expired or was revoked. Reconnect GitHub." }, { status: 401, headers: noStore });
    }
    if (!profileResponse.ok) return NextResponse.json({ error: "GitHub could not verify this connection." }, { status: 502, headers: noStore });
    const profile = await profileResponse.json() as GitHubProfile;

    // /user/repos is authenticated and includes private repositories the token can access.
    // /users/{login}/repos is public-profile scoped and silently misses collaborators,
    // organization repositories, and private repositories.
    const repositories: GitHubRepo[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const response = await fetch(
        "https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization&sort=updated&per_page=100&page=" + page,
        { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) },
      );
      if (response.status === 401) return NextResponse.json({ error: "GitHub authorization expired or was revoked. Reconnect GitHub." }, { status: 401, headers: noStore });
      if (response.status === 403) {
        const remaining = response.headers.get("x-ratelimit-remaining");
        if (remaining === "0") return NextResponse.json({ error: "GitHub rate limit reached. Try again shortly." }, { status: 429, headers: noStore });
        return NextResponse.json({
          error: "GitHub denied repository access. Reconnect and grant the repository permissions requested by SAMURA.",
          needsReauthorization: true,
        }, { status: 403, headers: noStore });
      }
      if (!response.ok) return NextResponse.json({ error: "Could not load repositories authorized for this GitHub account." }, { status: 502, headers: noStore });
      const pageRepos = await response.json() as unknown;
      if (!Array.isArray(pageRepos)) return NextResponse.json({ error: "GitHub returned an invalid repository list." }, { status: 502, headers: noStore });
      repositories.push(...pageRepos as GitHubRepo[]);
      if (pageRepos.length < 100) break;
    }

    const scopes = (account.scope ?? "").split(/[ ,]+/).filter(Boolean);
    const hasRepoScope = scopes.includes("repo") || scopes.includes("public_repo");
    return NextResponse.json({
      account: { login: profile.login, name: profile.name, avatarUrl: profile.avatar_url, profileUrl: profile.html_url },
      repositories: repositories.map(repo => ({
        id: repo.id, name: repo.name, fullName: repo.full_name, url: repo.html_url,
        description: repo.description, language: repo.language, stars: repo.stargazers_count,
        updatedAt: repo.updated_at, isPrivate: repo.private, defaultBranch: repo.default_branch,
        permissions: {
          read: repo.permissions?.pull === true,
          write: repo.permissions?.push === true && hasRepoScope,
          admin: repo.permissions?.admin === true,
        },
      })),
      capabilities: {
        read: true,
        write: hasRepoScope,
        requiresReauthorizationForWrite: !hasRepoScope,
        scope: scopes,
      },
      truncated: repositories.length >= 300,
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "The GitHub connection could not be read securely." }, { status: 503, headers: noStore });
  }
}
