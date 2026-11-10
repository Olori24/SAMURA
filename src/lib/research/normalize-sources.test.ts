import { describe, expect, it } from "vitest";
import { normalizeResearchSources } from "./normalize-sources";

describe("normalizeResearchSources", () => {
  it("keeps valid HTTPS sources and bounds the result count", () => {
    const sources = normalizeResearchSources([
      { title: " One ", url: "https://example.com/a", content: " Evidence " },
      { title: "Two", url: "https://example.org/b", content: "Text" },
      { title: "Three", url: "https://example.net/c", content: "Text" },
    ], 2);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual({ title: "One", url: "https://example.com/a", content: "Evidence" });
  });

  it("rejects non-HTTPS, credentialed, malformed, and duplicate URLs", () => {
    const sources = normalizeResearchSources([
      { title: "HTTP", url: "http://example.com", content: "unsafe scheme" },
      { title: "Credentials", url: "https://user:pass@example.com", content: "credentialed" },
      { title: "Valid", url: "https://example.com/a", content: "valid" },
      { title: "Duplicate", url: "https://example.com/a", content: "duplicate" },
      { title: "Malformed", url: "javascript:alert(1)", content: "bad" },
    ]);

    expect(sources).toEqual([{ title: "Valid", url: "https://example.com/a", content: "valid" }]);
  });

  it("truncates long source fields and handles unknown input", () => {
    const sources = normalizeResearchSources([{ title: "T".repeat(250), url: "https://example.com", content: "x".repeat(2000) }]);
    expect(sources[0].title).toHaveLength(200);
    expect(sources[0].content).toHaveLength(1600);
    expect(normalizeResearchSources(null)).toEqual([]);
  });
});
