import OpenAI from "openai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { getImageProviderConfig } from "@/lib/ai/image-provider-config";
import { getSafeProviderImageUrl } from "@/lib/ai/image-provider-image";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Please sign in to create images." }, { status: 401 });

  const env = getServerEnv();
  const imageConfig = getImageProviderConfig(env);
  const rate = await checkDistributedRateLimit("image:" + user.id, 5, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You've reached the image creation limit. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  const body = await parseBoundedJson(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." }, { status: body.tooLarge ? 413 : 400 });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Enter a prompt between 3 and 2,000 characters." }, { status: 400 });

  if (!imageConfig) {
    return NextResponse.json(
      { error: "Image creation is not configured yet. Ask an administrator to configure a compatible image-generation service." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (imageConfig.provider === "gemini") {
      const aspectRatio = parsed.data.size === "1536x1024" ? "3:2" : parsed.data.size === "1024x1536" ? "2:3" : "1:1";
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": imageConfig.apiKey },
        body: JSON.stringify({
          model: imageConfig.model,
          input: parsed.data.prompt,
          response_format: { type: "image", aspect_ratio: aspectRatio, image_size: "1K" },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(55_000),
      });
      if (response.status === 429) return NextResponse.json({ error: "Gemini image generation is busy or its quota is exhausted. Try again later." }, { status: 429 });
      if (!response.ok) return NextResponse.json({ error: "Gemini could not generate this image. Check API access, model availability and billing." }, { status: 502 });
      const interaction = await response.json() as { output_image?: { data?: string; mime_type?: string } };
      const imageData = interaction.output_image?.data;
      const mimeType = interaction.output_image?.mime_type ?? "image/png";
      if (!imageData || !/^image\/(png|jpeg|webp)$/.test(mimeType)) {
        return NextResponse.json({ error: "Gemini returned no supported image output. Please try again." }, { status: 502 });
      }
      return NextResponse.json({ image: "data:" + mimeType + ";base64," + imageData, revisedPrompt: null }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const client = new OpenAI({ apiKey: imageConfig.apiKey, ...(imageConfig.baseURL ? { baseURL: imageConfig.baseURL } : {}), timeout: 55_000, maxRetries: 0 });
    const result = await client.images.generate({
      model: imageConfig.model,
      prompt: parsed.data.prompt,
      size: parsed.data.size,
    });
    const imageData = result.data?.[0];
    const revisedPrompt = imageData?.revised_prompt ?? null;
    if (imageData?.b64_json) {
      return NextResponse.json({ image: "data:image/png;base64," + imageData.b64_json, revisedPrompt }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (imageData?.url) {
      const safeImageUrl = getSafeProviderImageUrl(imageData.url);
      if (!safeImageUrl) {
        return NextResponse.json({ error: "The image provider returned an unsafe image URL. A valid HTTPS URL without embedded credentials is required." }, { status: 502 });
      }
      return NextResponse.json({ image: safeImageUrl, revisedPrompt }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "The image provider returned no image. Please try again." }, { status: 502 });
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status === 429) {
      return NextResponse.json({ error: "The image provider is busy or its quota is exhausted. Try again later." }, { status: 429 });
    }
    return NextResponse.json({ error: "Image generation failed. Check provider access and billing, then try again." }, { status: 502 });
  }
}
