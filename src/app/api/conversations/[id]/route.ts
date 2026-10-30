import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { conversations, messages } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { withUserTransaction } from "@/db/user-transaction";

export const runtime = "nodejs";
const idSchema = z.string().uuid();
const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  archived: z.boolean().optional(),
}).strict().refine((value) => value.title !== undefined || value.archived !== undefined);

async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  return session?.user ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const user = await currentUser();
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
      }).from(messages).where(and(eq(messages.conversationId, id), eq(messages.userId, user.id)))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(500);
      // Keep the most recent turns available while returning them in chronological order.
      return { conversation, messages: history.reverse() };
    });
    if (!result) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Conversation service is temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const limit = await checkDistributedRateLimit("conversation-update:" + user.id, 60, 60_000);
    if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many conversation updates. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const body = await parseBoundedJson(request, 4_096);
    if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." }, { status: body.tooLarge ? 413 : 400 });
    const parsed = updateSchema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "Provide a valid title or archive state." }, { status: 400 });
    const updated = await withUserTransaction(user.id, async (tx) => {
      const [row] = await tx.update(conversations).set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
        updatedAt: new Date(),
      }).where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
        .returning({ id: conversations.id, title: conversations.title, archived: conversations.archived, createdAt: conversations.createdAt, updatedAt: conversations.updatedAt });
      return row ?? null;
    });
    if (!updated) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ conversation: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Conversation could not be updated." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const limit = await checkDistributedRateLimit("conversation-delete:" + user.id, 20, 60_000);
    if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many conversation deletions. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const deleted = await withUserTransaction(user.id, async (tx) => {
      const [row] = await tx.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, user.id))).returning({ id: conversations.id });
      return row ?? null;
    });
    if (!deleted) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ deleted: true, id: deleted.id }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Conversation could not be deleted." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
