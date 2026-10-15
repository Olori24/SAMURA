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
import { createGitHubPatchDigest, isSafeGitHubPatchPath, matchesExpectedBaseCommit } from "@/lib/github-engine-validation";
import { parseBoundedJson } from "@/lib/parse-bounded-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(201),
  baseBranch: z.string().min(1).max(250).refine(value => ![...value].some(char => " ~^:?*[]\\".includes(char))),
  expectedBaseCommit: z.string().regex(/^[0-9a-f]{40}$/i),
  title: z.string().trim().min(5).max(120),
  body: z.string().max(10_000).default(""),
  idempotencyKey: z.string().uuid(),
  approved: z.literal(true),
  changes: z.array(z.object({
    path: z.string().min(1).max(500).refine(p => !p.startsWith("/") && !p.includes("\\") && p.split("/").every(s => s && s !== "." && s !== ".." && s.length <= 255)),
    content: z.string().max(200_000),
    operation: z.enum(["add", "modify"]),
  }).strict()).min(1).max(30),
}).strict();

const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };
type GitHubError = { message?: string; errors?: Array<{ message?: string }> };

async function github<T>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as GitHubError;
    const message = response.status === 401 ? "GitHub authorization expired or was revoked. Reconnect GitHub."
      : response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0" ? "GitHub rate limit reached. Try again shortly."
      : response.status === 403 ? "GitHub denied this operation. Verify repository write permission and branch protection."
      : response.status === 404 ? "Repository or base branch not found for this account."
      : response.status === 409 || response.status === 422 ? "GitHub rejected the update because the repository state changed or the request conflicts. Refresh the repository and review the diff again."
      : "GitHub could not complete the publishing operation.";
    const error = new Error(message);
    Object.assign(error, { status: response.status, upstream: payload.message });
    throw error;
  }
  return response.status === 204 ? ({} as T) : await response.json() as T;
}

function safeErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    const status = error.status;
    return status === 401 || status === 403 || status === 404 || status === 409 || status === 422 || status === 429 ? status : 502;
  }
  return 502;
}

/**
 * Publishes a user-approved, bounded file patch through GitHub's Git Data API.
 * This route creates a branch and pull request; it never pushes to the base branch
 * directly and never executes repository code. The client must only send changes
 * after displaying the exact patch for human review.
 */
export async function POST(request: Request) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503, headers: noStore });
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: noStore });

  const rate = await checkDistributedRateLimit("github-publish:" + session.user.id, 5, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503, headers: noStore });
  if (!rate.allowed) return NextResponse.json({ error: "Publishing is temporarily rate limited." }, { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } });

  const body = await parseBoundedJson(request, 600_000);
  if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Publishing request exceeds the size limit." : "Invalid JSON request body." }, { status: body.tooLarge ? 413 : 400, headers: noStore });
  const payload = schema.safeParse(body.value);
  if (!payload.success) return NextResponse.json({ error: "Invalid publishing request. Provide a reviewed patch and explicit approval." }, { status: 400, headers: noStore });
  const input = payload.data;
  if (new Set(input.changes.map(c => c.path)).size !== input.changes.length) {
    return NextResponse.json({ error: "The patch contains duplicate paths." }, { status: 400, headers: noStore });
  }
  const totalBytes = input.changes.reduce((sum, change) => sum + Buffer.byteLength(change.content, "utf8"), 0);
  if (totalBytes > 500_000) return NextResponse.json({ error: "Patch exceeds the 500 KB total limit." }, { status: 413, headers: noStore });
  if (input.changes.some(c => !isSafeGitHubPatchPath(c.path))) {
    return NextResponse.json({ error: "This path is outside the supported safe patch paths. Security-sensitive, binary, manifest, and deployment files require a separate review." }, { status: 400, headers: noStore });
  }

  const [account] = await getDb().select({ accessToken: accounts.accessToken, scope: accounts.scope })
    .from(accounts).where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, githubProviderId()))).limit(1);
  if (!account?.accessToken) return NextResponse.json({ error: "Connect GitHub before publishing." }, { status: 409, headers: noStore });
  // The saved OAuth scope string can be incomplete for older linked accounts.
  // GitHub's authenticated repository response below is authoritative: publishing
  // proceeds only when it confirms push permission for this exact repository.
  const scopes = (account.scope ?? "").split(/[ ,]+/).filter(Boolean);

  try {
    const token = decryptConnectorToken(account.accessToken);
    const repository = input.repository.split("/").map(encodeURIComponent).join("/");
    const repoInfo = await github<{ full_name: string; default_branch: string; permissions?: { push?: boolean }; archived?: boolean; disabled?: boolean }>(token, "/repos/" + repository);
    if (repoInfo.full_name.toLowerCase() !== input.repository.toLowerCase() || repoInfo.permissions?.push !== true || repoInfo.archived || repoInfo.disabled) {
      return NextResponse.json({ error: "This GitHub account does not have effective write access to the selected repository." }, { status: 403, headers: noStore });
    }
    if (scopes.includes("public_repo") && !scopes.includes("repo")) {
      const visibility = await github<{ private: boolean }>(token, "/repos/" + repository);
      if (visibility.private) return NextResponse.json({ error: "This connection only has public-repository scope. Reconnect with the required repository access." }, { status: 403, headers: noStore });
    }

    const branchSlug = "samura/approval-" + input.idempotencyKey;
    const branchRef = "refs/heads/" + branchSlug;
    const branchName = branchSlug;
    const patchDigest = createGitHubPatchDigest({
      repository: input.repository.toLowerCase(),
      baseBranch: input.baseBranch,
      expectedBaseCommit: input.expectedBaseCommit,
      title: input.title,
      body: input.body,
      changes: input.changes,
    });
    // Recover completed publishes after a timeout or lost response. Never create a
    // second commit/PR for the same approval key, and reject key reuse for other content.
    const existingRef = await github<{ object: { sha: string } }>(
      token, "/repos/" + repository + "/git/ref/heads/" + encodeURIComponent(branchName),
    ).catch(error => {
      if (safeErrorStatus(error) === 404) return null;
      throw error;
    });
    if (existingRef) {
      const existingCommit = await github<{ sha: string; message: string }>(
        token, "/repos/" + repository + "/git/commits/" + existingRef.object.sha,
      );
      if (!existingCommit.message.includes("SAMURA-PATCH-DIGEST:" + patchDigest)) {
        return NextResponse.json({ error: "This idempotency key has already been used for a different patch. Generate a new approval key before publishing.", retryable: false }, { status: 409, headers: noStore });
      }
      const existingPulls = await github<Array<{ html_url: string; number: number; state: string; head: { ref: string; sha: string }; base: { ref: string } }>>(
        token, "/repos/" + repository + "/pulls?state=all&head=" + encodeURIComponent(repoInfo.full_name.split("/")[0] + ":" + branchName) + "&base=" + encodeURIComponent(input.baseBranch),
      );
      const existingPull = existingPulls.find(pull => pull.head.sha === existingCommit.sha);
      if (!existingPull) {
        return NextResponse.json({ error: "A matching SAMURA branch already exists, but its pull request could not be verified. Inspect the branch in GitHub before retrying.", retryable: false }, { status: 409, headers: noStore });
      }
      const verification = await github<{ sha: string; files?: Array<{ filename: string; status: string }> }>(
        token, "/repos/" + repository + "/commits/" + existingCommit.sha,
      );
      const expectedPaths = input.changes.map(change => change.path).sort();
      const actualPaths = (verification.files ?? []).map(file => file.filename).sort();
      const verified = verification.sha === existingCommit.sha && expectedPaths.length === actualPaths.length && expectedPaths.every((path, index) => path === actualPaths[index]);
      return NextResponse.json({
        ok: verified, verified, branch: existingPull.head.ref, baseBranch: existingPull.base.ref,
        commitSha: existingCommit.sha, commitUrl: "https://github.com/" + input.repository + "/commit/" + existingCommit.sha,
        pullRequestUrl: existingPull.html_url, pullRequestNumber: existingPull.number,
        pullRequestState: existingPull.state, changedFiles: actualPaths, patchDigest,
        message: verified ? "Recovered the existing verified draft pull request for this approval key." : "An existing pull request was found, but its changed-file set did not match the approved patch. Review it manually.",
        recovered: true,
      }, { status: verified ? 200 : 502, headers: noStore });
    }

    const base = await github<{ object: { sha: string } }>(token, "/repos/" + repository + "/git/ref/heads/" + encodeURIComponent(input.baseBranch));
    if (!matchesExpectedBaseCommit(input.expectedBaseCommit, base.object.sha)) {
      return NextResponse.json({ error: "The selected branch changed after SAMURA inspected it. Regenerate the patch against the latest branch and review it again.", retryable: true }, { status: 409, headers: noStore });
    }
    const baseCommit = await github<{ tree: { sha: string }; parents: Array<{ sha: string }> }>(token, "/repos/" + repository + "/git/commits/" + base.object.sha);
    const treeEntries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
    for (const change of input.changes) {
      const existing = await github<{ sha: string; type: string } | null>(token, "/repos/" + repository + "/contents/" + change.path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(input.baseBranch)).catch(error => {
        if (safeErrorStatus(error) === 404) return null;
        throw error;
      });
      if (change.operation === "add" && existing) throw Object.assign(new Error("A file marked as new already exists. Refresh and review the patch."), { status: 409 });
      if (change.operation === "modify" && (!existing || existing.type !== "file")) throw Object.assign(new Error("A file marked for modification does not resolve to an existing text file. Refresh and review the patch."), { status: 409 });
      const blob = await github<{ sha: string }>(token, "/repos/" + repository + "/git/blobs", "POST", { content: change.content, encoding: "utf-8" });
      treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const tree = await github<{ sha: string }>(token, "/repos/" + repository + "/git/trees", "POST", {
      base_tree: baseCommit.tree.sha, tree: treeEntries,
    });
    const commit = await github<{ sha: string; html_url: string }>(token, "/repos/" + repository + "/git/commits", "POST", {
      message: input.title + "\n\nSAMURA-PATCH-DIGEST:" + patchDigest, tree: tree.sha, parents: [base.object.sha],
    });
    // Fail closed if the base moved while the patch was being prepared.
    const latestBase = await github<{ object: { sha: string } }>(token, "/repos/" + repository + "/git/ref/heads/" + encodeURIComponent(input.baseBranch));
    if (latestBase.object.sha !== base.object.sha) {
      return NextResponse.json({ error: "The base branch changed while this patch was being prepared. Refresh repository context and review the diff again.", retryable: true }, { status: 409, headers: noStore });
    }
    // Create the branch only after the commit exists; never overwrite an existing ref.
    // The commit parent is the base SHA inspected above, so unrelated files remain untouched.
    await github(token, "/repos/" + repository + "/git/refs", "POST", { ref: branchRef, sha: commit.sha });
    const pull = await github<{ html_url: string; number: number; state: string; head: { ref: string }; base: { ref: string } }>(
      token, "/repos/" + repository + "/pulls", "POST", {
        title: input.title,
        body: input.body + "\n\n---\nCreated by SAMURA after explicit user approval. Idempotency: " + input.idempotencyKey,
        head: branchName, base: input.baseBranch, draft: true,
      },
    );
    const expectedPaths = input.changes.map(c => c.path).sort();
    const verification = await github<{ sha: string; files?: Array<{ filename: string; status: string }> }>(
      token, "/repos/" + repository + "/commits/" + commit.sha,
    );
    const actualPaths = (verification.files ?? []).map(f => f.filename).sort();
    const verified = verification.sha === commit.sha && expectedPaths.every(p => actualPaths.includes(p));
    return NextResponse.json({
      ok: verified,
      verified,
      branch: pull.head.ref,
      baseBranch: pull.base.ref,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      pullRequestUrl: pull.html_url,
      pullRequestNumber: pull.number,
      pullRequestState: pull.state,
      changedFiles: actualPaths,
      patchDigest,
      message: verified ? "Branch and draft pull request created and verified." : "GitHub accepted the change, but verification was incomplete. Review the pull request before proceeding.",
    }, { status: verified ? 201 : 502, headers: noStore });
  } catch (error) {
    const status = safeErrorStatus(error);
    const message = error instanceof Error ? error.message : "GitHub publishing failed.";
    return NextResponse.json({ error: message, retryable: status === 429 || status >= 500 }, { status, headers: noStore });
  }
}
