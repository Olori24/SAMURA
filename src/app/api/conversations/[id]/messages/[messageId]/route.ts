import { and, asc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { messages, conversations } from "@/db/schema";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { withUserTransaction } from "@/db/user-transaction";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: {
  params: Promise<{ id: string; messageId: string }>;
}) {
  if (!isRuntimeConfigured()) {
    return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { id, messageId } = await context.params;
  const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!idPattern.test(id) || !idPattern.test(messageId)) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const limit = await checkDistributedRateLimit("conversation-edit:" + user.id, 20, 60_000);
  if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
  if (!limit.allowed) return NextResponse.json(
    { error: "Too many message edits. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
  );

  try {
    const deleted = await withUserTransaction(user.id, async (tx) => {
      const [conversation] = await tx.select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
        .limit(1)
        .for("update");
      if (!conversation) return "not_found" as const;

      // Look up the target directly under both ownership constraints. Do not
      // let a bounded history window make older messages appear nonexistent.
      const [target] = await tx.select({
        id: messages.id,
        role: messages.role,
        createdAt: messages.createdAt,
      }).from(messages).where(and(
        eq(messages.id, messageId),
        eq(messages.conversationId, id),
        eq(messages.userId, user.id),
      )).limit(1);
      if (!target || target.role !== "user") return "not_found" as const;

      // Read the complete scoped conversation so a large history cannot hide a
      // later user turn. The ID is a deterministic tie-breaker for equal times.
      const history = await tx.select({
        id: messages.id,
        role: messages.role,
        createdAt: messages.createdAt,
      }).from(messages)
        .where(and(eq(messages.conversationId, id), eq(messages.userId, user.id)))
        .orderBy(asc(messages.createdAt), asc(messages.id));

      const targetIndex = history.findIndex((message) => message.id === target.id);
      if (targetIndex < 0) return "not_found" as const;
      if (history.slice(targetIndex + 1).some((message) => message.role === "user")) {
        return "not_latest" as const;
      }

      const idsToDelete = history.slice(targetIndex).map((message) => message.id);
      if (!idsToDelete.length) return "not_found" as const;
      await tx.delete(messages).where(and(
        eq(messages.conversationId, id),
        eq(messages.userId, user.id),
        inArray(messages.id, idsToDelete),
      ));
      await tx.update(conversations)
        .set({ updatedAt: new Date() })
        .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)));
      return "deleted" as const;
    });

    if (deleted === "not_found") return NextResponse.json({ error: "Message not found." }, { status: 404 });
    if (deleted === "not_latest") return NextResponse.json(
      { error: "Only the most recent user message can be edited. Earlier turns are preserved." },
      { status: 409 },
    );
    return NextResponse.json({ deleted: true, messageId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The message could not be edited right now." }, { status: 503 });
  }
}
