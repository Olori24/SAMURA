import OpenAI from "openai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { getImageProviderConfig } from "@/lib/ai/image-provider-config";
import { getGeminiImageOutput, getSafeProviderImageUrl } from "@/lib/ai/image-provider-image";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
});

const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Please sign in to create images." }, { status: 401, headers: noStore });

  const env = getServerEnv();
  const rate = await checkDistributedRateLimit("image:" + user.id, 5, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503, headers: noStore });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You've reached the image creation limit. Please wait a minute and try again." },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await parseBoundedJson(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." }, { status: body.tooLarge ? 413 : 400, headers: noStore });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Enter a prompt between 3 and 2,000 characters." }, { status: 400, headers: noStore });

  const imageConfig = getImageProviderConfig(env);
  if (!imageConfig) {
    return NextResponse.json(
      { error: "Image creation is not configured yet. Configure a compatible image service or a Gemini API key." },
      { status: 503, headers: noStore },
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
      if (response.status === 429) return NextResponse.json({ error: "Gemini image generation is busy or its quota is exhausted. Try again later." }, { status: 429, headers: noStore });
      if (!response.ok) {
        return NextResponse.json({ error: "Gemini could not generate this image. Check API access, model availability and billing." }, { status: 502, headers: noStore });
      }
      const interaction = await response.json();
      const imageOutput = getGeminiImageOutput(interaction);
      if (!imageOutput) {
        return NextResponse.json({ error: "Gemini returned no supported image output. Please try again." }, { status: 502, headers: noStore });
      }
      return NextResponse.json({ image: "data:" + imageOutput.mimeType + ";base64," + imageOutput.data, revisedPrompt: null }, { headers: noStore });
    }

    const client = new OpenAI({
      apiKey: imageConfig.apiKey,
      ...(imageConfig.baseURL ? { baseURL: imageConfig.baseURL } : {}),
      timeout: 55_000,
      maxRetries: 0,
    });
    const result = await client.images.generate({
      model: imageConfig.model,
      prompt: parsed.data.prompt,
      size: parsed.data.size,
    });
    const imageData = result.data?.[0];
    const revisedPrompt = imageData?.revised_prompt ?? null;
    if (imageData?.b64_json) {
      return NextResponse.json({ image: "data:image/png;base64," + imageData.b64_json, revisedPrompt }, { headers: noStore });
    }
    if (imageData?.url) {
      const safeImageUrl = getSafeProviderImageUrl(imageData.url);
      if (!safeImageUrl) {
        return NextResponse.json({ error: "The image provider returned an unsafe image URL. A valid HTTPS URL without embedded credentials is required." }, { status: 502, headers: noStore });
      }
      return NextResponse.json({ image: safeImageUrl, revisedPrompt }, { headers: noStore });
    }
    return NextResponse.json({ error: "The image provider returned no image. Please try again." }, { status: 502, headers: noStore });
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status === 429) {
      return NextResponse.json({ error: "The image provider is busy or its quota is exhausted. Try again later." }, { status: 429, headers: noStore });
    }
    return NextResponse.json({ error: "Image generation failed. Check provider access and billing, then try again." }, { status: 502, headers: noStore });
  }
}
