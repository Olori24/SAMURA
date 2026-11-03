import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubBlobSha, createGitHubPatchDigest } from "@/lib/github-engine-validation";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSession: vi.fn(),
  isRuntimeConfigured: vi.fn(),
  checkRateLimit: vi.fn(),
  decryptToken: vi.fn(),
  providerId: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("drizzle-orm", () => ({
  and: (...values: unknown[]) => values,
  eq: (...values: unknown[]) => values,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings: [...strings], values }),
}));
vi.mock("@/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/db/schema", () => ({ accounts: { accessToken: "accessToken", userId: "userId", providerId: "providerId" } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/runtime-config", () => ({ isRuntimeConfigured: mocks.isRuntimeConfigured }));
vi.mock("@/lib/distributed-rate-limit", () => ({ checkDistributedRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/connectors/github-token", () => ({
  decryptConnectorToken: mocks.decryptToken,
  githubProviderId: mocks.providerId,
}));

import { POST } from "./route";

const baseSha = "a".repeat(40);
const movedBaseSha = "b".repeat(40);
const commitSha = "c".repeat(40);
const treeSha = "d".repeat(40);
const filePath = "src/app/studio/new-feature.tsx";
const fileContent = "export const answer = 42;\n";
const blobSha = createGitHubBlobSha(fileContent);
const approvalId = "8f3b8d6e-3b44-4c3f-8e6e-8e8e7f8e8e8e";

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function requestBody() {
  return {
    repository: "acme/project",
    baseBranch: "main",
    expectedBaseCommit: baseSha,
    title: "Add a reviewed feature",
    body: "Reviewed by the user.",
    idempotencyKey: approvalId,
    approved: true,
    changes: [{ path: filePath, content: fileContent, operation: "add" as const }],
  };
}

function installGitHubMock(options: { movedBase?: boolean; invalidParent?: boolean; existingBranch?: boolean; pullAlreadyExists?: boolean; pullAppearsAfterConflict?: boolean } = {}) {
  const calls: Array<{ path: string; method: string; body: Record<string, unknown> | null }> = [];
  let mainRefReads = 0;
  let pullListReads = 0;
  let branchCreated = false;
  const patchDigest = createGitHubPatchDigest({
    repository: "acme/project", baseBranch: "main", expectedBaseCommit: baseSha,
    title: "Add a reviewed feature", body: "Reviewed by the user.",
    changes: [{ path: filePath, content: fileContent, operation: "add" }],
  });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : null;
    calls.push({ path: url.pathname + url.search, method, body });
    const path = url.pathname;
    if (path === "/repos/acme/project" && method === "GET") {
      return response({ full_name: "acme/project", default_branch: "main", permissions: { push: true }, archived: false, disabled: false });
    }
    if (path.endsWith("/git/ref/heads/main") && method === "GET") {
      mainRefReads += 1;
      return response({ object: { sha: options.movedBase && mainRefReads > 1 ? movedBaseSha : baseSha } });
    }
    if (path.includes("/git/ref/heads/samura%2Fapproval-") && method === "GET") {
      return options.existingBranch || branchCreated ? response({ object: { sha: commitSha } }) : response({ message: "Not Found" }, 404);
    }
    if (path.endsWith("/contents/" + filePath) && method === "GET") return response({ message: "Not Found" }, 404);
    if (path.endsWith("/git/commits/" + baseSha) && method === "GET") return response({ tree: { sha: treeSha }, parents: [{ sha: "0".repeat(40) }] });
    if (path.endsWith("/git/commits/" + commitSha) && method === "GET") {
      return response({
        sha: commitSha,
        message: "Add a reviewed feature\n\nSAMURA-PATCH-DIGEST:" + patchDigest,
        tree: { sha: treeSha },
        parents: [{ sha: options.invalidParent ? movedBaseSha : baseSha }],
      });
    }
    if (path.endsWith("/git/blobs") && method === "POST") return response({ sha: blobSha }, 201);
    if (path.endsWith("/git/trees") && method === "POST") return response({ sha: treeSha }, 201);
    if (path.endsWith("/git/commits") && method === "POST") return response({ sha: commitSha, html_url: "https://github.com/acme/project/commit/" + commitSha }, 201);
    if (path.endsWith("/git/refs") && method === "POST") { branchCreated = true; return response({ ref: "refs/heads/samura/approval-" + approvalId }, 201); }
    if (path.endsWith("/pulls") && url.searchParams.get("state") === "all" && method === "GET") {
      pullListReads += 1;
      const found = options.pullAlreadyExists || (options.pullAppearsAfterConflict && pullListReads > 1);
      return response(found ? [{
        html_url: "https://github.com/acme/project/pull/123", number: 123, state: "open",
        head: { ref: "samura/approval-" + approvalId, sha: commitSha },
        base: { ref: "main", sha: baseSha },
      }] : []);
    }
    if (path.endsWith("/pulls") && method === "POST") {
      if (options.pullAppearsAfterConflict) return response({ message: "A pull request already exists for this branch." }, 422);
      return response({
        html_url: "https://github.com/acme/project/pull/123", number: 123, state: "open",
        head: { ref: "samura/approval-" + approvalId, sha: commitSha },
        base: { ref: "main", sha: baseSha },
      }, 201);
    }
    if (path.endsWith("/pulls") && method === "PATCH") return response({ state: "closed" });
    if (path.endsWith("/commits/" + commitSha) && method === "GET") return response({
      sha: commitSha, parents: [{ sha: baseSha }], files: [{ filename: filePath, status: "added" }],
    });
    if (path.endsWith("/git/trees/" + treeSha) && method === "GET") return response({
      truncated: false, tree: [{ path: filePath, mode: "100644", type: "blob", sha: blobSha }],
    });
    if (path.includes("/git/ref/heads/samura%2Fapproval-") && method === "GET") return response({ object: { sha: commitSha } });
    return response({ message: "Unexpected mocked GitHub request: " + method + " " + path }, 500);
  }));
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isRuntimeConfigured.mockReturnValue(true);
  mocks.getSession.mockResolvedValue({ user: { id: "user-123" } });
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.decryptToken.mockReturnValue("github-token");
  mocks.providerId.mockReturnValue("github");
  mocks.getDb.mockReturnValue({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ accessToken: "encrypted-token" }] }) }) }),
    transaction: async (callback: (tx: { execute: () => Promise<{ rows: Array<{ locked: boolean }> }> }) => Promise<unknown>) =>
      callback({ execute: async () => ({ rows: [{ locked: true }] }) }),
  });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("POST /api/connectors/github/publish", () => {
  it("creates and verifies a draft pull request for the exact approved patch", async () => {
    const calls = installGitHubMock();
    const responseValue = await POST(new Request("https://samura.test/api/connectors/github/publish", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()),
    }));
    const payload = await responseValue.json();
    expect(responseValue.status).toBe(201);
    expect(payload).toMatchObject({ ok: true, verified: true, commitSha, pullRequestNumber: 123, changedFiles: [filePath] });
    expect(calls.some(call => call.method === "POST" && call.path.endsWith("/pulls"))).toBe(true);
  });

  it("rejects a base branch that moves while the patch is being prepared", async () => {
    const calls = installGitHubMock({ movedBase: true });
    const responseValue = await POST(new Request("https://samura.test/api/connectors/github/publish", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()),
    }));
    expect(responseValue.status).toBe(409);
    expect(calls.some(call => call.method === "POST" && call.path.endsWith("/git/refs"))).toBe(false);
  });

  it("closes the draft when the created commit has an unexpected parent", async () => {
    const calls = installGitHubMock({ invalidParent: true });
    const responseValue = await POST(new Request("https://samura.test/api/connectors/github/publish", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()),
    }));
    expect(responseValue.status).toBe(502);
    expect(calls.some(call => call.method === "PATCH" && call.path.endsWith("/pulls/123") && call.body?.state === "closed")).toBe(true);
  });

  it("recovers a 422 pull-request race without creating a duplicate", async () => {
    const calls = installGitHubMock({ existingBranch: true, pullAppearsAfterConflict: true });
    const responseValue = await POST(new Request("https://samura.test/api/connectors/github/publish", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody()),
    }));
    const payload = await responseValue.json();
    expect(responseValue.status, JSON.stringify(payload)).toBe(200);
    expect(payload).toMatchObject({ ok: true, verified: true, recovered: true, pullRequestNumber: 123 });
    expect(calls.filter(call => call.method === "POST" && call.path.endsWith("/pulls"))).toHaveLength(1);
  });
});
