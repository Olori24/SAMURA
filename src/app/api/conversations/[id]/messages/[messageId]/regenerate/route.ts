import { and, asc, eq, gt, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { conversations, messages, usageRecords } from "@/db/schema";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { getServerEnv } from "@/lib/env";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { createAIClient } from "@/lib/ai/provider";
import { withUserTransaction } from "@/db/user-transaction";
import { buildProviderMessages } from "@/lib/ai/provider-messages";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  mode: z.enum(["chat", "code"]).default("chat"),
}).strict();

type HistoryMessage = { id: string; role: string; content: string };

export async function POST(request: Request, context: {
  params: Promise<{ id: string; messageId: string }>;
}) {
  if (!isRuntimeConfigured()) {
    return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  }
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { id, messageId } = await context.params;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id) || !uuidPattern.test(messageId)) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const limit = await checkDistributedRateLimit("conversation-regenerate:" + user.id, 5, 60_000);
  if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503 });
  if (!limit.allowed) return NextResponse.json(
    { error: "Too many regeneration requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
  );

  const body = await parseBoundedJson(request, 2_048);
  if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." }, { status: body.tooLarge ? 413 : 400 });
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid regeneration request." }, { status: 400 });

  try {
    const setup = await withUserTransaction(user.id, async (tx) => {
      const [conversation] = await tx.select({ id: conversations.id, updatedAt: conversations.updatedAt })
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
        .limit(1)
        .for("update");
      if (!conversation) return { status: "not_found" as const };

      const [target] = await tx.select({
        id: messages.id, role: messages.role, content: messages.content, createdAt: messages.createdAt,
      }).from(messages)
        .where(and(
          eq(messages.id, messageId),
          eq(messages.conversationId, id),
          eq(messages.userId, user.id),
        ))
        .limit(1);
      if (!target || target.role !== "user") return { status: "not_found" as const };

      const afterTarget = or(
        gt(messages.createdAt, target.createdAt),
        and(eq(messages.createdAt, target.createdAt), gt(messages.id, target.id)),
      );
      const [laterUser] = await tx.select({ id: messages.id }).from(messages).where(and(
        eq(messages.conversationId, id),
        eq(messages.userId, user.id),
        eq(messages.role, "user"),
        afterTarget,
      )).limit(1);
      if (laterUser) return { status: "not_latest" as const };

      const beforeTarget = or(
        lt(messages.createdAt, target.createdAt),
        and(eq(messages.createdAt, target.createdAt), lt(messages.id, target.id)),
      );
      const previousHistory = await tx.select({
        id: messages.id, role: messages.role, content: messages.content,
      }).from(messages)
        .where(and(eq(messages.conversationId, id), eq(messages.userId, user.id), beforeTarget))
        .orderBy( /* latest prior messages first */ desc(messages.createdAt), desc(messages.id))
        .limit(39);
      previousHistory.reverse();
      const tailSnapshot = await tx.select({ id: messages.id }).from(messages)
        .where(and(eq(messages.conversationId, id), eq(messages.userId, user.id), afterTarget))
        .orderBy(asc(messages.createdAt), asc(messages.id));
      return {
        status: "ok" as const,
        history: [...previousHistory, target] as HistoryMessage[],
        targetCreatedAt: target.createdAt,
        snapshotUpdatedAt: conversation.updatedAt,
        tailSnapshotIds: tailSnapshot.map((item) => item.id),
      };
    });

    if (setup.status === "not_found") return NextResponse.json({ error: "Message not found." }, { status: 404 });
    if (setup.status === "not_latest") return NextResponse.json({ error: "Only the latest user turn can be regenerated." }, { status: 409 });

    const env = getServerEnv();
    const ai = createAIClient(env);
    const providerMessages = buildProviderMessages(parsed.data.mode, setup.history);
    const completion = await (async () => {
      try {
        return await ai.client.chat.completions.create({
          model: ai.model,
          messages: providerMessages,
          stream: false,
          max_tokens: env.SAMURA_MAX_OUTPUT_TOKENS,
        }, { timeout: maxDuration * 1_000 - 5_000, signal: request.signal });
      } catch (error) {
        await withUserTransaction(user.id, async (tx) => {
          await tx.insert(usageRecords).values({ userId: user.id, conversationId: id, provider: ai.provider, model: ai.model, status: request.signal.aborted ? "cancelled" : "failed" });
        }).catch(() => undefined);
        throw error;
      }
    })();
    const answer = completion.choices[0]?.message?.content;
    await withUserTransaction(user.id, async (tx) => {
      await tx.insert(usageRecords).values({
        userId: user.id, conversationId: id, provider: ai.provider, model: ai.model,
        inputTokens: completion.usage?.prompt_tokens ?? null,
        outputTokens: completion.usage?.completion_tokens ?? null,
        status: typeof answer === "string" && answer.trim() ? "complete" : "empty",
      });
    });

    if (typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json({ error: "The provider returned an empty response. Your previous response was preserved." }, { status: 502 });
    }

    if (request.signal.aborted) {
      return NextResponse.json({ error: "Regeneration was cancelled. Your previous response was preserved." }, { status: 499, headers: { "Cache-Control": "no-store" } });
    }

    const committed = await withUserTransaction(user.id, async (tx) => {
      if (request.signal.aborted) return null;
      const [conversation] = await tx.select({ id: conversations.id, updatedAt: conversations.updatedAt })
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
        .limit(1)
        .for("update");
      if (!conversation || conversation.updatedAt.getTime() !== setup.snapshotUpdatedAt.getTime()) return null;

      const [target] = await tx.select({ id: messages.id, role: messages.role, createdAt: messages.createdAt })
        .from(messages)
        .where(and(
          eq(messages.id, messageId),
          eq(messages.conversationId, id),
          eq(messages.userId, user.id),
        ))
        .limit(1);
      if (!target || target.role !== "user" || target.createdAt.getTime() !== setup.targetCreatedAt.getTime()) return null;

      const afterTarget = or(
        gt(messages.createdAt, target.createdAt),
        and(eq(messages.createdAt, target.createdAt), gt(messages.id, target.id)),
      );
      const [laterUser] = await tx.select({ id: messages.id }).from(messages).where(and(
        eq(messages.conversationId, id),
        eq(messages.userId, user.id),
        eq(messages.role, "user"),
        afterTarget,
      )).limit(1);
      if (laterUser) return null;

      const currentTail = await tx.select({ id: messages.id }).from(messages)
        .where(and(eq(messages.conversationId, id), eq(messages.userId, user.id), afterTarget))
        .orderBy(asc(messages.createdAt), asc(messages.id));
      if (currentTail.length !== setup.tailSnapshotIds.length
        || currentTail.some((item, index) => item.id !== setup.tailSnapshotIds[index])) return null;

      await tx.delete(messages).where(and(
        eq(messages.conversationId, id),
        eq(messages.userId, user.id),
        afterTarget,
      ));
      const [replacement] = await tx.insert(messages).values({
        conversationId: id,
        userId: user.id,
        role: "assistant",
        content: answer,
        status: "complete",
      }).returning({ id: messages.id });
      await tx.update(conversations).set({ updatedAt: new Date() })
        .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)));
      return replacement ?? null;
    });

    if (!committed) return NextResponse.json({ error: "The conversation changed while regenerating. Your existing messages were preserved." }, { status: 409 });
    return NextResponse.json({ answer, messageId: committed.id }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Regeneration failed. Your previous response was preserved." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
