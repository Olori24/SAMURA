export type GeminiImageOutput = { data: string; mimeType: "image/png" | "image/jpeg" | "image/webp" };

export function extractGeminiImageOutput(payload: unknown): GeminiImageOutput | null {
  if (!payload || typeof payload !== "object" || !("steps" in payload) || !Array.isArray(payload.steps)) return null;
  for (const step of payload.steps) {
    if (!step || typeof step !== "object" || !("type" in step) || step.type !== "model_output" || !("content" in step) || !Array.isArray(step.content)) continue;
    for (const block of step.content) {
      if (!block || typeof block !== "object" || !("type" in block) || block.type !== "image" || !("data" in block) || typeof block.data !== "string" || !block.data) continue;
      const mimeType = "mime_type" in block && typeof block.mime_type === "string" ? block.mime_type : "image/png";
      if (mimeType !== "image/png" && mimeType !== "image/jpeg" && mimeType !== "image/webp") continue;
      return { data: block.data, mimeType };
    }
  }
  return null;
}
