import { describe, expect, it } from "vitest";
import {
  decodeGitHubText,
  isGitHubHtmlUrl,
  isValidRepositoryName,
  isValidRepositoryPath,
} from "./github-inspection";

describe("GitHub inspection input validation", () => {
  it("accepts normal owner/repository names", () => {
    expect(isValidRepositoryName("octocat/Hello-World")).toBe(true);
    expect(isValidRepositoryName("a/b")).toBe(true);
  });

  it("rejects malformed repository names", () => {
    for (const value of ["", "octocat", "/repo", "owner/", "owner/repo/extra", "../repo", "owner/..", "owner/repo?x=1", "owner/repo\\n"]) {
      expect(isValidRepositoryName(value)).toBe(false);
    }
  });

  it("accepts ordinary repository paths and rejects traversal or control characters", () => {
    expect(isValidRepositoryPath("src/app.ts")).toBe(true);
    expect(isValidRepositoryPath("README.md")).toBe(true);
    for (const value of ["", "/etc/passwd", "../secret", "src/../secret", "src\\\\secret", "src/./secret", "src/secret\\u0000.txt", "a//b", "a/../b"]) {
      expect(isValidRepositoryPath(value)).toBe(false);
    }
  });

  it("decodes only bounded, size-consistent UTF-8 base64 text", () => {
    expect(decodeGitHubText("c2FmZQ==", 4)).toBe("safe");
    expect(decodeGitHubText("c2FmZQ==", 5)).toBeNull();
    expect(decodeGitHubText("c2FmZQ==", 4, 3)).toBeNull();
    expect(decodeGitHubText("%%%=", 3)).toBeNull();
    expect(decodeGitHubText(" /w==", 1)).toBeNull();
  });

  it("accepts only HTTPS GitHub URLs", () => {
    expect(isGitHubHtmlUrl("https://github.com/octocat/Hello-World")).toBe(true);
    expect(isGitHubHtmlUrl("http://github.com/octocat/Hello-World")).toBe(false);
    expect(isGitHubHtmlUrl("https://evil.example/octocat/Hello-World")).toBe(false);
    expect(isGitHubHtmlUrl("https://user:pass@github.com/octocat/Hello-World")).toBe(false);
  });
});
