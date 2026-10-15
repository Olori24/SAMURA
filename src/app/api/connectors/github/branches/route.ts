import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { decryptConnectorToken, githubProviderId } from "@/lib/connectors/github-token";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { parseBoundedJson } from "@/lib/parse-bounded-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(201),
}).strict();
const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };

type Repo = { full_name: string; default_branch: string; permissions?: { pull?: boolean } };
type Branch = { name: string; commit: { sha: string } };
type Commit = { sha: string; html_url: string; commit: { message: string; author?: { name?: string | null; date?: string | null } | null } };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

async function github<T>(token: string, path: string): Promise<T> {
  const response = await fetch("https://api.github.com" + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? "GitHub authorization expired. Reconnect GitHub."
      : response.status === 403 ? "GitHub denied access or rate-limited this request."
      : response.status === 404 ? "Repository was not found for this GitHub account."
      : "Could not retrieve repository branches and commits.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > 1_000_000) {
    await response.body?.cancel().catch(() => undefined);
    throw Object.assign(new Error("GitHub returned too much repository metadata."), { status: 413 });
  }
  return response.json() as Promise<T>;
}

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) return json({ error: "SAMURA is not configured yet." }, 503);
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return json({ error: "Authentication required." }, 401);
  const rate = await checkDistributedRateLimit("github-read:" + session.user.id, 30, 60_000);
  if (rate.unavailable) return json({ error: "Rate limiting is temporarily unavailable." }, 503);
  if (!rate.allowed) return NextResponse.json({ error: "Repository inspection is temporarily rate limited." }, { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } });

  const body = await parseBoundedJson(request, 4_000);
  if (!body.ok) return json({ error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." }, body.tooLarge ? 413 : 400);
  const parsed = inputSchema.safeParse(body.value);
  if (!parsed.success) return json({ error: "Select a valid GitHub repository." }, 400);

  try {
    const [account] = await getDb().select({ accessToken: accounts.accessToken })
      .from(accounts).where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, githubProviderId()))).limit(1);
    if (!account?.accessToken) return json({ error: "Connect GitHub before inspecting repositories." }, 409);
    const token = decryptConnectorToken(account.accessToken);
    const repository = parsed.data.repository.split("/").map(encodeURIComponent).join("/");
    const repo = await github<Repo>(token, "/repos/" + repository);
    if (repo.full_name.toLowerCase() !== parsed.data.repository.toLowerCase() || repo.permissions?.pull !== true) {
      return json({ error: "This GitHub account cannot read the selected repository." }, 403);
    }
    const [branches, commits] = await Promise.all([
      github<Branch[]>(token, "/repos/" + repository + "/branches?per_page=100"),
      github<Commit[]>(token, "/repos/" + repository + "/commits?per_page=10"),
    ]);
    return json({
      repository: repo.full_name,
      defaultBranch: repo.default_branch,
      branches: branches.map(branch => ({ name: branch.name, sha: branch.commit.sha })),
      recentCommits: commits.map(commit => ({
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message.split("\n")[0].slice(0, 240),
        author: commit.commit.author?.name ?? "Unknown author",
        date: commit.commit.author?.date ?? null,
        url: commit.html_url,
      })),
      truncated: branches.length === 100,
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? ([401, 403, 404, 413, 429].includes(error.status) ? error.status : 502)
      : 502;
    return json({ error: error instanceof Error ? error.message : "Repository inspection failed." }, status);
  }
}
