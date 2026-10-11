import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { getConnector } from "@/lib/connectors/registry";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ connectorId: z.literal("text-tools"), action: z.literal("word_count"), text: z.string().max(20_000) }),
  z.object({ connectorId: z.literal("text-tools"), action: z.literal("character_count"), text: z.string().max(20_000) }),
  z.object({ connectorId: z.literal("text-tools"), action: z.literal("format_json"), text: z.string().min(2).max(20_000) }),
]);

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) {
    return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rate = checkRateLimit("connector-execute:" + user.id, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Plugin action limit reached. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await parseBoundedJson(request, 24_000);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." },
      { status: body.tooLarge ? 413 : 400 },
    );
  }

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Unsupported plugin action or invalid input." }, { status: 400 });

  const connector = getConnector(parsed.data.connectorId);
  if (!connector || connector.status !== "available" || !connector.actions.includes(parsed.data.action)) {
    return NextResponse.json({ error: "This connector action is not enabled." }, { status: 403 });
  }

  switch (parsed.data.action) {
    case "word_count": {
      const words = parsed.data.text.trim().match(/\S+/g) ?? [];
      return NextResponse.json({ connectorId: connector.id, action: parsed.data.action, result: { words: words.length } }, { headers: { "Cache-Control": "no-store" } });
    }
    case "character_count":
      return NextResponse.json({ connectorId: connector.id, action: parsed.data.action, result: { characters: parsed.data.text.length, charactersWithoutWhitespace: parsed.data.text.replace(/\s/g, "").length } }, { headers: { "Cache-Control": "no-store" } });
    case "format_json": {
      try {
        const value: unknown = JSON.parse(parsed.data.text);
        return NextResponse.json({ connectorId: connector.id, action: parsed.data.action, result: { formatted: JSON.stringify(value, null, 2) } }, { headers: { "Cache-Control": "no-store" } });
      } catch {
        return NextResponse.json({ error: "That text is not valid JSON." }, { status: 422 });
      }
    }
  }
}
