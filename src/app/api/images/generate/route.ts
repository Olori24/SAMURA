import OpenAI from "openai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { parseBoundedJson } from "@/lib/parse-bounded-json";

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

  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Image creation is not configured yet. An administrator must add OPENAI_API_KEY as a server-side secret before this feature can generate images." },
      { status: 503 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 0 });
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: parsed.data.prompt,
      size: parsed.data.size,
    });
    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) return NextResponse.json({ error: "The image provider returned no image. Please try again." }, { status: 502 });
    return NextResponse.json({ image: "data:image/png;base64," + encoded, revisedPrompt: result.data?.[0]?.revised_prompt ?? null });
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status === 429) {
      return NextResponse.json({ error: "The image provider is busy or its quota is exhausted. Try again later." }, { status: 429 });
    }
    return NextResponse.json({ error: "Image generation failed. Check provider access and billing, then try again." }, { status: 502 });
  }
}
