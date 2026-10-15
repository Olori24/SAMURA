import { describe, expect, it } from "vitest";
import { countWords, MAX_DOCUMENT_CHARACTERS, safeDocumentFilename } from "./document-utils";

describe("document utilities", () => {
  it("normalizes filenames and strips unsafe punctuation", () => {
    expect(safeDocumentFilename("  My Quarterly Report!.md ")).toBe("my-quarterly-report-md");
    expect(safeDocumentFilename("../../.env")).toBe("env");
    expect(safeDocumentFilename("")).toBe("samura-document");
  });

  it("limits filenames to 72 characters", () => {
    expect(safeDocumentFilename("a".repeat(100))).toHaveLength(72);
  });

  it("counts words without counting whitespace", () => {
    expect(countWords("  hello\n world  ")).toBe(2);
    expect(countWords(" \n  ")).toBe(0);
  });

  it("defines a bounded document draft size", () => {
    expect(MAX_DOCUMENT_CHARACTERS).toBe(200_000);
  });
});
