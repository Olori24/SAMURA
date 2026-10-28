import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { conversations, messages } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { withUserTransaction } from "@/db/user-transaction";

export const runtime = "nodejs";
const idSchema = z.string().uuid();
const updateSchema = z.object({ title: z.string().trim().min(1).max(160) }).strict();

async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  return session?.user ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const result = await withUserTransaction(user.id, async (tx) => {
      const [conversation] = await tx.select({
        id: conversations.id, title: conversations.title, createdAt: conversations.createdAt, updatedAt: conversations.updatedAt,
      }).from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, user.id))).limit(1);
      if (!conversation) return null;
      const history = await tx.select({
        id: messages.id, role: messages.role, content: messages.content, status: messages.status, createdAt: messages.createdAt,
      }).from(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, user.id))).orderBy(asc(messages.createdAt)).limit(500);
      return { conversation, messages: history };
    });
    if (!result) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Conversation service is temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const body = await parseBoundedJson(request, 4_096);
  if (!body.ok) return NextResponse.json(
    { error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." },
    { status: body.tooLarge ? 413 : 400 },
  );
  const parsed = updateSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "A title between 1 and 160 characters is required." }, { status: 400 });

  try {
    const updated = await withUserTransaction(user.id, async (tx) => {
      const [row] = await tx.update(conversations)
        .set({ title: parsed.data.title, updatedAt: new Date() })
        .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
        .returning({ id: conversations.id, title: conversations.title, createdAt: conversations.createdAt, updatedAt: conversations.updatedAt });
      return row ?? null;
    });
    if (!updated) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ conversation: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not rename this conversation right now." }, { status: 503 });
  }
}
