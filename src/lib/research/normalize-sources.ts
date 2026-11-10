import { z } from "zod";

export interface ResearchSource {
  title: string;
  url: string;
  content: string;
}

const resultSchema = z.object({
  title: z.string().optional(),
  url: z.string().url(),
  content: z.string().optional(),
});

export function normalizeResearchSources(input: unknown, limit = 5): ResearchSource[] {
  if (!Array.isArray(input)) return [];
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    const parsed = resultSchema.safeParse(item);
    if (!parsed.success) continue;
    try {
      const url = new URL(parsed.data.url);
      if (url.protocol !== "https:" || url.username || url.password || seen.has(url.href)) continue;
      seen.add(url.href);
      sources.push({
        title: (parsed.data.title?.trim() || url.hostname).slice(0, 200),
        url: url.href,
        content: (parsed.data.content ?? "").trim().slice(0, 1600),
      });
      if (sources.length >= Math.max(1, Math.min(limit, 10))) break;
    } catch {
      // Ignore malformed provider results instead of returning unsafe links.
    }
  }
  return sources;
}
