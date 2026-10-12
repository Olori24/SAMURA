import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type GitHubRepository = {
  full_name: string;
  html_url: string;
  default_branch: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
};
type GitHubTree = {
  truncated: boolean;
  tree: Array<{ path: string; type: string; size?: number; sha: string }>;
};

const allowedPath = (path: string) =>
  !path.startsWith("/") &&
  !path.split("/").some(part => part === ".." || part === ".") &&
  path.length <= 500;

async function githubGet<T>(path: string): Promise<T> {
  const response = await fetch("https://api.github.com" + path, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const error = new Error(response.status === 404 ? "Repository or file not found." : response.status === 403 ? "GitHub rate limit reached. Try again shortly." : "GitHub could not complete the inspection.");
    Object.assign(error, { status: response.status === 404 ? 404 : response.status === 403 ? 429 : 502 });
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function GET(request: Request) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rate = checkRateLimit("github-inspect:" + session.user.id, 20, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Inspection limit reached. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const url = new URL(request.url);
  const repository = (url.searchParams.get("repository") ?? "").trim();
  const filePath = (url.searchParams.get("path") ?? "").trim();
  if (!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repository) || repository.includes("..")) {
    return NextResponse.json({ error: "Provide a valid public repository in owner/name format." }, { status: 400 });
  }
  if (filePath && !allowedPath(filePath)) return NextResponse.json({ error: "Invalid repository file path." }, { status: 400 });

  try {
    const repo = await githubGet<GitHubRepository>("/repos/" + repository.split("/").map(encodeURIComponent).join("/"));
    if (repo.private) return NextResponse.json({ error: "This read-only inspector supports public repositories only." }, { status: 403 });
    if (filePath) {
      const file = await githubGet<{ type: string; path: string; size: number; encoding?: string; content?: string; html_url: string }>(
        "/repos/" + repository.split("/").map(encodeURIComponent).join("/") + "/contents/" + filePath.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(repo.default_branch),
      );
      if (file.type !== "file" || file.size > 200_000 || file.encoding !== "base64" || !file.content) {
        return NextResponse.json({ error: "This file is not a supported text file or exceeds the 200 KB inspection limit." }, { status: 413 });
      }
      const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
      return NextResponse.json({ repository: repo.full_name, branch: repo.default_branch, file: { path: file.path, url: file.html_url, size: file.size, content } }, { headers: { "Cache-Control": "no-store" } });
    }

    const tree = await githubGet<GitHubTree>("/repos/" + repository.split("/").map(encodeURIComponent).join("/") + "/git/trees/" + encodeURIComponent(repo.default_branch) + "?recursive=1");
    const files = tree.tree.filter(item => item.type === "blob").slice(0, 500).map(item => ({ path: item.path, size: item.size ?? null, sha: item.sha }));
    const readmeEntry = tree.tree.find(item => item.type === "blob" && /^readme(?:\.md|\.rst|\.txt)?$/i.test(item.path) && !item.path.includes("/"));
    let readme: { path: string; content: string } | null = null;
    if (readmeEntry && (readmeEntry.size ?? 0) <= 200_000) {
      try {
        const file = await githubGet<{ type: string; path: string; size: number; encoding?: string; content?: string }>(
          "/repos/" + repository.split("/").map(encodeURIComponent).join("/") + "/contents/" + encodeURIComponent(readmeEntry.path) + "?ref=" + encodeURIComponent(repo.default_branch),
        );
        if (file.type === "file" && file.encoding === "base64" && file.content) {
          readme = { path: file.path, content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, 60_000) };
        }
      } catch { /* Repository inventory remains useful if README retrieval fails. */ }
    }
    return NextResponse.json({
      repository: { fullName: repo.full_name, url: repo.html_url, description: repo.description, defaultBranch: repo.default_branch, language: repo.language, stars: repo.stargazers_count, updatedAt: repo.updated_at },
      files, readme, truncated: tree.truncated || tree.tree.length > 500,
      limits: { maxFiles: 500, maxFileBytes: 200_000, readOnly: true },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Repository inspection failed." }, { status });
  }
}
