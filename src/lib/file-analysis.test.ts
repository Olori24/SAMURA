import { describe, expect, it } from "vitest";
import {
  isSupportedTextFilename,
  numberFileAnalysisLines,
  validateFileAnalysisText,
} from "./file-analysis";

describe("file analysis text validation", () => {
  it("allows supported text-based formats only", () => {
    expect(isSupportedTextFilename("notes.md")).toBe(true);
    expect(isSupportedTextFilename("data.CSV")).toBe(true);
    expect(isSupportedTextFilename("report.pdf")).toBe(false);
    expect(isSupportedTextFilename("../secret.txt")).toBe(false);
  });

  it("rejects empty, binary, oversized, and excessive-line content", () => {
    expect(validateFileAnalysisText("notes.txt", "  ")).toContain("empty");
    expect(validateFileAnalysisText("notes.txt", "a\\0b")).toContain("binary");
    expect(validateFileAnalysisText("notes.txt", "x".repeat(60_001))).toContain("60,000");
    expect(validateFileAnalysisText("notes.txt", "x\\n".repeat(2_001))).toContain("2,000");
  });

  it("numbers source lines for precise citations", () => {
    expect(numberFileAnalysisLines("First line\\r\\nSecond line")).toEqual({
      lineCount: 2,
      numberedContent: "[L1] First line\\n[L2] Second line",
    });
  });
});
