import { describe, expect, it } from "vitest";
import { createGitHubPatchDigest, isSafeGitHubPatchPath, matchesExpectedBaseCommit } from "./github-engine-validation";

describe("GitHub patch path validation", () => {
  it("allows normal source and documentation files", () => {
    expect(isSafeGitHubPatchPath("src/app/api/version/route.ts")).toBe(true);
    expect(isSafeGitHubPatchPath("docs/engineering.md")).toBe(true);
    expect(isSafeGitHubPatchPath("tests/version.test.ts")).toBe(true);
  });

  it("rejects traversal, absolute paths, and backslashes", () => {
    for (const path of ["../secret", "src/../secret", "/etc/passwd", "src\\secret.ts", "src//bad.ts", "src/./bad.ts"]) {
      expect(isSafeGitHubPatchPath(path)).toBe(false);
    }
  });

  it("blocks secrets, workflows, manifests, and sensitive security surfaces", () => {
    for (const path of [".env", ".env.production", ".github/workflows/deploy.yml", "package.json", "package-lock.json", "src/lib/auth.ts", "src/lib/session.ts", "src/db/schema.ts", "src/lib/connectors/github-token.ts", "docs/private_key.pem", "src/assets/logo.png", "public/banner.svg"]) {
      expect(isSafeGitHubPatchPath(path)).toBe(false);
    }
  });

  it("rejects paths outside supported project directories", () => {
    expect(isSafeGitHubPatchPath("README.md")).toBe(false);
    expect(isSafeGitHubPatchPath("public/logo.svg")).toBe(false);
    expect(isSafeGitHubPatchPath("docs/guide.md")).toBe(true);
  });
});


describe("GitHub reviewed base commit validation", () => {
  const inspected = "0123456789abcdef0123456789abcdef01234567";

  it("accepts only the exact valid commit that was inspected", () => {
    expect(matchesExpectedBaseCommit(inspected, inspected)).toBe(true);
  });

  it("rejects stale commits and malformed SHA values", () => {
    expect(matchesExpectedBaseCommit(inspected, "1123456789abcdef0123456789abcdef01234567")).toBe(false);
    expect(matchesExpectedBaseCommit("", inspected)).toBe(false);
    expect(matchesExpectedBaseCommit("main", inspected)).toBe(false);
    expect(matchesExpectedBaseCommit(inspected, "not-a-sha")).toBe(false);
  });
});


describe("GitHub publish idempotency digest", () => {
  const base = {
    repository: "Olori24/SAMURA",
    baseBranch: "main",
    expectedBaseCommit: "0123456789abcdef0123456789abcdef01234567",
    title: "Add safe helper",
    body: "Reviewed change",
    changes: [
      { path: "src/lib/example.ts", content: "export const value = 1;", operation: "add" as const },
      { path: "docs/example.md", content: "# Example", operation: "add" as const },
    ],
  };

  it("is stable when the same approved paths are provided in a different order", () => {
    expect(createGitHubPatchDigest(base)).toBe(createGitHubPatchDigest({ ...base, changes: [...base.changes].reverse() }));
  });

  it("changes when repository, base branch, title, body, path, operation, or content changes", () => {
    expect(createGitHubPatchDigest(base)).not.toBe(createGitHubPatchDigest({ ...base, baseBranch: "release" }));
    expect(createGitHubPatchDigest(base)).not.toBe(createGitHubPatchDigest({ ...base, expectedBaseCommit: "1123456789abcdef0123456789abcdef01234567" }));
    expect(createGitHubPatchDigest(base)).not.toBe(createGitHubPatchDigest({ ...base, title: "Different title" }));
    expect(createGitHubPatchDigest(base)).not.toBe(createGitHubPatchDigest({ ...base, changes: [{ ...base.changes[0], content: "changed" }, base.changes[1]] }));
  });
});
