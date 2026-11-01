export type GeminiImageResponse = {
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; data?: string; mime_type?: string }>;
  }>;
};

export function getGeminiImageOutput(interaction: GeminiImageResponse): { data: string; mimeType: string } | null {
  const imageBlock = (interaction.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((block) => block.type === "image" && typeof block.data === "string" && block.data.length > 0)
    .pop();
  if (!imageBlock?.data) return null;
  const mimeType = imageBlock.mime_type ?? "image/png";
  if (!/^image\/(png|jpeg|webp)$/.test(mimeType)) return null;
  return { data: imageBlock.data, mimeType };
}

export function getSafeProviderImageUrl(value: string): string | null {
  try {
    const imageUrl = new URL(value);
    if (imageUrl.protocol !== "https:" || imageUrl.username || imageUrl.password) return null;
    return imageUrl.toString();
  } catch {
    return null;
  }
}
