import { describe, expect, it } from "vitest";
import { createGitHubPatchDigest, isSafeGitHubPatchPath, matchesExpectedBaseCommit } from "./github-engine-validation";

describe("isSafeGitHubPatchPath", () => {
  it.each(["src/app/studio/page.tsx", "src/lib/csv-analysis.ts", "docs/product/roadmap.md", "tests/feature.test.ts"])(
    "allows ordinary source and documentation files: %s",
    path => expect(isSafeGitHubPatchPath(path)).toBe(true),
  );

  it.each([
    "src/app/api/connectors/github/publish/route.ts",
    "src/app/api/auth/route.ts",
    "src/app/api/conversations/[id]/route.ts",
    "src/app/api/chat/route.ts",
    "src/app/studio/github-engine/page.tsx",
    "src/app/studio/connect/page.tsx",
    "src/db/user-transaction.ts",
    "src/lib/auth.ts",
    "src/lib/connectors/github-token.ts",
    "src/lib/github-engine-validation.ts",
    "src/lib/env.ts",
    "src/lib/runtime-config.ts",
    "src/lib/ai/provider-config.ts",
    "src/lib/distributed-rate-limit.ts",
    "src/proxy.ts",
    ".github/workflows/ci.yml",
    "package.json",
    "package-lock.json",
    "src/app/studio/../../api/auth/route.ts",
    "/src/app/studio/page.tsx",
    "src\\app\\studio\\page.tsx",
  ])("rejects protected or unsafe paths: %s", path => {
    expect(isSafeGitHubPatchPath(path)).toBe(false);
  });
});

describe("matchesExpectedBaseCommit", () => {
  const sha = "a".repeat(40);
  it("accepts only an exact full commit SHA", () => {
    expect(matchesExpectedBaseCommit(sha, sha)).toBe(true);
    expect(matchesExpectedBaseCommit(sha, "b".repeat(40))).toBe(false);
    expect(matchesExpectedBaseCommit(sha.slice(0, 7), sha)).toBe(false);
  });
});

describe("createGitHubPatchDigest", () => {
  const first = { path: "src/a.ts", content: "a", operation: "add" as const };
  const second = { path: "src/b.ts", content: "b", operation: "modify" as const };
  const base = { repository: "Olori24/SAMURA", baseBranch: "main", expectedBaseCommit: "a".repeat(40), title: "Test patch", body: "Reviewed change" };

  it("is independent of file-change ordering", () => {
    expect(createGitHubPatchDigest({ ...base, changes: [first, second] }))
      .toBe(createGitHubPatchDigest({ ...base, changes: [second, first] }));
  });
  it("normalizes repository casing", () => {
    expect(createGitHubPatchDigest({ ...base, changes: [first] }))
      .toBe(createGitHubPatchDigest({ ...base, repository: "olori24/samura", changes: [first] }));
  });
  it("changes when approved content changes", () => {
    expect(createGitHubPatchDigest({ ...base, changes: [first] }))
      .not.toBe(createGitHubPatchDigest({ ...base, changes: [{ ...first, content: "different" }] }));
  });
});
