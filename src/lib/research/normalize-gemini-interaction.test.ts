import { describe, expect, it } from "vitest";
import { normalizeGeminiResearchInteraction } from "./normalize-gemini-interaction";

describe("normalizeGeminiResearchInteraction", () => {
  it("converts grounded URL annotations into inline links and source cards", () => {
    const result = normalizeGeminiResearchInteraction({
      steps: [{ type: "model_output", content: [{
        type: "text", text: "The report supports this claim.", annotations: [{
          type: "url_citation", url: "https://example.com/report", title: "Example report", start_index: 0, end_index: 31,
        }],
      }] }],
    });
    expect(result.answer).toContain("[1](<https://example.com/report>)");
    expect(result.sources).toEqual([{ title: "Example report", url: "https://example.com/report", content: "" }]);
  });

  it("deduplicates repeated source URLs", () => {
    const result = normalizeGeminiResearchInteraction({
      steps: [{ type: "model_output", content: [{
        type: "text", text: "First claim. Second claim.", annotations: [
          { type: "url_citation", url: "https://example.com/a", title: "A", start_index: 0, end_index: 12 },
          { type: "url_citation", url: "https://example.com/a", title: "A", start_index: 13, end_index: 26 },
        ],
      }] }],
    });
    expect(result.sources).toHaveLength(1);
    expect(result.answer.match(/\[1\]\(<https:\/\/example\.com\/a>\)/g)).toHaveLength(2);
  });

  it("rejects non-HTTPS citations and malformed annotation ranges", () => {
    const result = normalizeGeminiResearchInteraction({
      steps: [{ type: "model_output", content: [{
        type: "text", text: "Claim.", annotations: [
          { type: "url_citation", url: "http://example.com", start_index: 0, end_index: 6 },
          { type: "url_citation", url: "https://example.com", start_index: -1, end_index: 6 },
        ],
      }] }],
    });
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe("Claim.");
  });
});
