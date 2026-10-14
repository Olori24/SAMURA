import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { conversations, messages } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { withUserTransaction } from "@/db/user-transaction";

export const runtime = "nodejs";
const idSchema = z.string().uuid();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const result = await withUserTransaction(session.user.id, async (tx) => {
      const [conversation] = await tx.select({
        id: conversations.id, title: conversations.title, createdAt: conversations.createdAt, updatedAt: conversations.updatedAt,
      }).from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id))).limit(1);
      if (!conversation) return null;
      const history = await tx.select({
        id: messages.id, role: messages.role, content: messages.content, status: messages.status, createdAt: messages.createdAt,
      }).from(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, session.user.id))).orderBy(asc(messages.createdAt)).limit(500);
      return { conversation, messages: history };
    });
    if (!result) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Conversation service is temporarily unavailable." }, { status: 503 });
  }
}
