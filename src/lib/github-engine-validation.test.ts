import { describe, expect, it } from "vitest";
import { isSafeGitHubPatchPath } from "./github-engine-validation";

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
