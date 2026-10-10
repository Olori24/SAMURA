import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { conversations, messages } from "@/db/schema";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
const idSchema = z.string().uuid();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await auth.api.getSession({ headers: await headers() });
    if (!user?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const db = getDb();
    const [conversation] = await db.select({
      id: conversations.id, title: conversations.title, createdAt: conversations.createdAt, updatedAt: conversations.updatedAt,
    }).from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, user.user.id))).limit(1);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const history = await db.select({
      id: messages.id, role: messages.role, content: messages.content, status: messages.status, createdAt: messages.createdAt,
    }).from(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, user.user.id))).orderBy(asc(messages.createdAt)).limit(500);
    return NextResponse.json({ conversation, messages: history }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Conversation service is temporarily unavailable." }, { status: 503 });
  }
}
