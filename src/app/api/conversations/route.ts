import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { isRuntimeConfigured } from "@/lib/runtime-config";

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
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const limit = checkRateLimit("conversation-create:" + user.id, 30);
    if (!limit.allowed) return NextResponse.json({ error: "Too many new conversations. Try again shortly." }, { status: 429 });
    const raw = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(raw ?? {});
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
