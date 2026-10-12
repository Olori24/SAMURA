import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import {
  decodeGitHubText,
  isGitHubHtmlUrl,
  isValidRepositoryName,
  isValidRepositoryPath,
} from "@/lib/github-inspection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
type GitHubFile = {
  type: string;
  path: string;
  size: number;
  encoding?: string;
  content?: string;
  html_url?: string;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(data, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

async function githubGet<T>(path: string): Promise<T> {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const error = new Error(
      response.status === 404
        ? "Repository or file not found."
        : response.status === 403 && remaining === "0" || response.status === 429
          ? "GitHub rate limit reached. Try again shortly."
          : "GitHub could not complete the inspection.",
    );
    Object.assign(error, {
      status: response.status === 404 ? 404
        : response.status === 403 && remaining === "0" || response.status === 429 ? 429
          : 502,
      retryAfter: response.headers.get("retry-after"),
    });
    throw error;
  }

  return response.json() as Promise<T>;
}

function safeStatus(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return 502;
}

function retryAfter(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "retryAfter" in error && typeof error.retryAfter === "string") {
    return error.retryAfter;
  }
  return undefined;
}

export async function GET(request: Request) {
  if (!isRuntimeConfigured()) return json({ error: "SAMURA is not configured yet." }, 503);

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return json({ error: "Authentication required." }, 401);

  // Per-instance limits are defense in depth, not a substitute for a shared
  // distributed limiter or an edge/WAF rule.
  const globalRate = await checkDistributedRateLimit("github-inspect:global", 120, 60_000);
  if (globalRate.unavailable) return json({ error: "Rate limiting is temporarily unavailable." }, 503);
  if (!globalRate.allowed) {
    return json({ error: "Repository inspection is temporarily rate limited." }, 429, {
      "Retry-After": String(globalRate.retryAfterSeconds),
    });
  }
  const userRate = await checkDistributedRateLimit("github-inspect:user:" + session.user.id, 20, 60_000);
  if (userRate.unavailable) return json({ error: "Rate limiting is temporarily unavailable." }, 503);
  if (!userRate.allowed) {
    return json({ error: "Inspection limit reached. Try again shortly." }, 429, {
      "Retry-After": String(userRate.retryAfterSeconds),
    });
  }

  const url = new URL(request.url);
  const repository = (url.searchParams.get("repository") ?? "").trim();
  const filePath = (url.searchParams.get("path") ?? "").trim();

  if (!isValidRepositoryName(repository)) {
    return json({ error: "Provide a valid public repository in owner/name format." }, 400);
  }
  if (filePath && !isValidRepositoryPath(filePath)) {
    return json({ error: "Invalid repository file path." }, 400);
  }

  try {
    const encodedRepo = repository.split("/").map(encodeURIComponent).join("/");
    const repo = await githubGet<GitHubRepository>("/repos/" + encodedRepo);

    if (repo.private) return json({ error: "This read-only inspector supports public repositories only." }, 403);
    if (
      typeof repo.full_name !== "string" ||
      repo.full_name.toLowerCase() !== repository.toLowerCase() ||
      typeof repo.default_branch !== "string" ||
      !repo.default_branch ||
      repo.default_branch.length > 250 ||
      !isGitHubHtmlUrl(repo.html_url)
    ) {
      return json({ error: "GitHub returned unexpected repository metadata." }, 502);
    }

    if (filePath) {
      const file = await githubGet<GitHubFile>(
        "/repos/" + encodedRepo + "/contents/" +
        filePath.split("/").map(encodeURIComponent).join("/") +
        "?ref=" + encodeURIComponent(repo.default_branch),
      );
      if (file.type !== "file" || !Number.isSafeInteger(file.size) || file.size > 200_000) {
        return json({ error: "This file is not a supported regular file or exceeds the 200 KB inspection limit." }, 413);
      }
      if (file.encoding !== "base64" || typeof file.content !== "string" || !file.html_url || !isGitHubHtmlUrl(file.html_url)) {
        return json({ error: "This file is not available as bounded UTF-8 text." }, 415);
      }
      const content = decodeGitHubText(file.content, file.size);
      if (content === null) return json({ error: "This file is not valid bounded UTF-8 text." }, 415);

      return json({
        repository: repo.full_name,
        branch: repo.default_branch,
        file: { path: file.path, url: file.html_url, size: file.size, content },
      });
    }

    const tree = await githubGet<GitHubTree>(
      "/repos/" + encodedRepo + "/git/trees/" + encodeURIComponent(repo.default_branch) + "?recursive=1",
    );
    if (!Array.isArray(tree.tree)) return json({ error: "GitHub returned an invalid repository inventory." }, 502);

    const files = tree.tree
      .filter(item => item && item.type === "blob" && typeof item.path === "string" && typeof item.sha === "string")
      .slice(0, 500)
      .map(item => ({
        path: item.path.slice(0, 500),
        size: Number.isSafeInteger(item.size) && (item.size ?? 0) >= 0 ? item.size ?? null : null,
        sha: item.sha,
      }));

    const readmeEntry = tree.tree.find(item =>
      item?.type === "blob" &&
      typeof item.path === "string" &&
      /^readme(?:\.md|\.rst|\.txt)?$/i.test(item.path) &&
      !item.path.includes("/") &&
      Number.isSafeInteger(item.size) &&
      (item.size ?? 0) <= 200_000
    );

    let readme: { path: string; content: string } | null = null;
    if (readmeEntry) {
      try {
        const file = await githubGet<GitHubFile>(
          "/repos/" + encodedRepo + "/contents/" +
          encodeURIComponent(readmeEntry.path) +
          "?ref=" + encodeURIComponent(repo.default_branch),
        );
        if (file.type === "file" && file.encoding === "base64" && typeof file.content === "string") {
          const content = decodeGitHubText(file.content, file.size, 200_000);
          if (content !== null) readme = { path: file.path, content: content.slice(0, 60_000) };
        }
      } catch {
        // The bounded inventory remains useful if README retrieval fails.
      }
    }

    return json({
      repository: {
        fullName: repo.full_name,
        url: repo.html_url,
        description: typeof repo.description === "string" ? repo.description.slice(0, 1_000) : null,
        defaultBranch: repo.default_branch,
        language: typeof repo.language === "string" ? repo.language.slice(0, 100) : null,
        stars: Number.isSafeInteger(repo.stargazers_count) && repo.stargazers_count >= 0 ? repo.stargazers_count : 0,
        updatedAt: repo.updated_at,
      },
      files,
      readme,
      truncated: Boolean(tree.truncated) || tree.tree.length > 500,
      limits: { maxFiles: 500, maxFileBytes: 200_000, maxReadmeCharacters: 60_000, readOnly: true },
    });
  } catch (error) {
    const status = safeStatus(error);
    const message = status === 404
      ? "Repository or file not found."
      : status === 429
        ? "GitHub rate limit reached. Try again shortly."
        : "Repository inspection failed. Try again shortly.";
    const retry = retryAfter(error);
    return json({ error: message }, status, retry ? { "Retry-After": retry } : {});
  }
}
