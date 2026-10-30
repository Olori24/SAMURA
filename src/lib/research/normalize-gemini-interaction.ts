import { normalizeResearchSources, type ResearchSource } from "./normalize-sources";

type Citation = { type?: string; url?: string; title?: string; start_index?: number; end_index?: number };
type TextBlock = { type?: string; text?: string; annotations?: Citation[] };
type ModelStep = { type?: string; content?: TextBlock[] };

export function normalizeGeminiResearchInteraction(input: unknown): { answer: string; sources: ResearchSource[] } {
  if (!input || typeof input !== "object") return { answer: "", sources: [] };
  const interaction = input as { output_text?: unknown; steps?: unknown };
  const steps = Array.isArray(interaction.steps) ? interaction.steps as ModelStep[] : [];
  const blocks: Array<{ text: string; offset: number; annotations: Citation[] }> = [];
  let offset = 0;
  for (const step of steps) {
    if (step?.type !== "model_output" || !Array.isArray(step.content)) continue;
    for (const block of step.content) {
      if (block?.type !== "text" || typeof block.text !== "string") continue;
      blocks.push({ text: block.text, offset, annotations: Array.isArray(block.annotations) ? block.annotations : [] });
      offset += block.text.length + 1;
    }
  }
  const answerText = blocks.length
    ? blocks.map(block => block.text).join("\n")
    : typeof interaction.output_text === "string" ? interaction.output_text : "";
  if (!answerText.trim()) return { answer: "", sources: [] };

  const candidates: Array<{ start: number; end: number; title: string; url: string }> = [];
  for (const block of blocks) {
    for (const annotation of block.annotations) {
      if (annotation.type !== "url_citation" || typeof annotation.url !== "string" ||
          typeof annotation.start_index !== "number" || typeof annotation.end_index !== "number" ||
          !Number.isInteger(annotation.start_index) || !Number.isInteger(annotation.end_index) ||
          annotation.start_index < 0 || annotation.end_index <= annotation.start_index || annotation.end_index > block.text.length) continue;
      candidates.push({
        start: block.offset + annotation.start_index,
        end: block.offset + annotation.end_index,
        title: typeof annotation.title === "string" ? annotation.title : "",
        url: annotation.url,
      });
    }
  }
  const sources = normalizeResearchSources(candidates.map(item => ({ title: item.title, url: item.url, content: "" })), 5);
  const sourceIndex = new Map(sources.map((source, index) => [source.url, index + 1]));
  const insertions = new Map<number, string[]>();
  for (const item of candidates) {
    let canonicalUrl = "";
    try { canonicalUrl = new URL(item.url).href; } catch { continue; }
    const index = sourceIndex.get(canonicalUrl);
    if (!index || item.end > answerText.length) continue;
    const marker = "[" + index + "](<" + canonicalUrl + ">)";
    const current = insertions.get(item.end) ?? [];
    if (!current.includes(marker)) current.push(marker);
    insertions.set(item.end, current);
  }
  let answer = "";
  let cursor = 0;
  for (const [position, markers] of [...insertions.entries()].sort((a, b) => a[0] - b[0])) {
    answer += answerText.slice(cursor, position) + " " + markers.join(" ");
    cursor = position;
  }
  answer += answerText.slice(cursor);
  return { answer, sources };
}
