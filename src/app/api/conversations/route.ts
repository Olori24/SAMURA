import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { parseBoundedJson } from "@/lib/parse-bounded-json";

export const runtime = "nodejs";
const createSchema = z.object({ title: z.string().trim().min(1).max(160).optional() });

async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const db = getDb();
    const rows = await db.select({
      id: conversations.id, title: conversations.title, createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    }).from(conversations)
      .where(and(eq(conversations.userId, user.id), eq(conversations.archived, false)))
      .orderBy(desc(conversations.updatedAt)).limit(100);
    return NextResponse.json({ conversations: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Conversation service is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const limit = await checkDistributedRateLimit("conversation-create:" + user.id, 30, 60_000);
    if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if (!limit.allowed) return NextResponse.json({ error: "Too many new conversations. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } });
    const body = await parseBoundedJson(request, 4_096);
    if (!body.ok) return NextResponse.json(
      { error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." },
      { status: body.tooLarge ? 413 : 400 },
    );
    const parsed = createSchema.safeParse(body.value ?? {});
    if (!parsed.success) return NextResponse.json({ error: "Invalid conversation details." }, { status: 400 });
    const db = getDb();
    const [created] = await db.insert(conversations).values({
      userId: user.id, title: parsed.data.title ?? "New conversation",
    }).returning({ id: conversations.id, title: conversations.title, createdAt: conversations.createdAt, updatedAt: conversations.updatedAt });
    return NextResponse.json({ conversation: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not create a conversation. Check database configuration." }, { status: 503 });
  }
}
