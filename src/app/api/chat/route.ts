import OpenAI from "openai";
import { and, asc, desc, eq, gt, inArray, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserTransaction } from "@/db/user-transaction";
import { conversations, messages, usageRecords } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { getServerEnv } from "@/lib/env";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { createAIClient } from "@/lib/ai/provider";
import { linkAbortSignal } from "@/lib/abort-signal";
import { buildProviderMessages } from "@/lib/ai/provider-messages";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(12000),
  requestId: z.string().uuid(),
  editMessageId: z.string().uuid().optional(),
  mode: z.enum(["chat", "code"]).default("chat"),
});

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "SAMURA is not configured yet. Add database and authentication settings." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Please sign in to use SAMURA Chat." }, { status: 401 });

  const env = getServerEnv();
  const rate = await checkDistributedRateLimit("chat:" + user.id, env.SAMURA_MAX_REQUESTS_PER_MINUTE, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!rate.allowed) return NextResponse.json({ error: "You've reached the request limit. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } });

  let ai: ReturnType<typeof createAIClient>;
  try {
    ai = createAIClient(env);
  } catch (error) {
    // Keep diagnostics server-side and bounded. Strip URLs and common credential
    // assignments before emitting anything to trusted server logs.
    const rawMessage = error instanceof Error ? error.message : "";
    const safeMessage = rawMessage
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
      .replace(/(api[_-]?key|token|authorization|secret|password)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
      .slice(0, 300);
    console.error("[SAMURA] AI client configuration failed:", safeMessage || "No diagnostic message available.");
    return NextResponse.json(
      { error: "The AI service is not configured correctly. Please try again later or contact support." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const body = await parseBoundedJson(request, 20_000);
  if (!body.ok) return NextResponse.json(
    { error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." },
    { status: body.tooLarge ? 413 : 400 },
  );
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid message. Check the conversation and message fields." }, { status: 400 });
  if (parsed.data.message.length > env.SAMURA_MAX_INPUT_CHARS) return NextResponse.json({ error: "That message is too long. Please shorten it and try again." }, { status: 413 });

  type ChatSetup =
    | { status: "not_found" }
    | { status: "not_latest" }
    | { status: "duplicate" }
    | {
        status: "ok";
        conversation: { id: string; title: string };
        userMessage: { id: string };
        history: Array<{ role: string; content: string }>;
        editState?: { targetId: string; snapshotIds: string[] };
      };
  let setup: ChatSetup;
  try {
    setup = await withUserTransaction(user.id, async (tx) => {
      const [conversation] = await tx.select({ id: conversations.id, title: conversations.title })
        .from(conversations).where(and(eq(conversations.id, parsed.data.conversationId), eq(conversations.userId, user.id))).limit(1).for("update");
      if (!conversation) return { status: "not_found" as const };

      const [existing] = await tx.select({ id: messages.id })
        .from(messages).where(and(eq(messages.userId, user.id), eq(messages.requestId, parsed.data.requestId))).limit(1);
      if (existing) return { status: "duplicate" as const };

      let userMessage: { id: string };
      let history: Array<{ role: string; content: string }>;
      let editState: { targetId: string; snapshotIds: string[] } | undefined;

      if (parsed.data.editMessageId) {
        const [target] = await tx.select({ id: messages.id, role: messages.role, createdAt: messages.createdAt })
          .from(messages)
          .where(and(
            eq(messages.id, parsed.data.editMessageId),
            eq(messages.conversationId, conversation.id),
            eq(messages.userId, user.id),
          ))
          .limit(1);
        if (!target || target.role !== "user") return { status: "not_found" as const };
        const afterTarget = or(
          gt(messages.createdAt, target.createdAt),
          and(eq(messages.createdAt, target.createdAt), gt(messages.id, target.id)),
        );
        const [laterUser] = await tx.select({ id: messages.id }).from(messages).where(and(
          eq(messages.conversationId, conversation.id),
          eq(messages.userId, user.id),
          eq(messages.role, "user"),
          afterTarget,
        )).limit(1);
        if (laterUser) return { status: "not_latest" as const };

        // Keep the original turn durable while the replacement is generated.
        // Snapshot IDs let the final transaction reject concurrent conversation changes.
        const snapshot = await tx.select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.conversationId, conversation.id), eq(messages.userId, user.id)))
          .orderBy(asc(messages.createdAt), asc(messages.id));
        const targetIndex = snapshot.findIndex((item) => item.id === target.id);
        if (targetIndex < 0) return { status: "not_found" as const };

        const beforeTarget = or(
          lt(messages.createdAt, target.createdAt),
          and(eq(messages.createdAt, target.createdAt), lt(messages.id, target.id)),
        );
        const previousHistory = await tx.select({ role: messages.role, content: messages.content })
          .from(messages)
          .where(and(eq(messages.conversationId, conversation.id), eq(messages.userId, user.id), beforeTarget))
          .orderBy(desc(messages.createdAt), desc(messages.id))
          .limit(39);
        previousHistory.reverse();
        history = [...previousHistory, { role: "user", content: parsed.data.message }];
        userMessage = { id: parsed.data.requestId };
        editState = { targetId: target.id, snapshotIds: snapshot.map((item) => item.id) };
      } else {
        const [prior] = await tx.select({ id: messages.id }).from(messages)
          .where(and(eq(messages.conversationId, conversation.id), eq(messages.userId, user.id))).orderBy(desc(messages.createdAt), desc(messages.id)).limit(1);
        const [createdUserMessage] = await tx.insert(messages).values({
          conversationId: conversation.id, userId: user.id, role: "user", content: parsed.data.message,
          status: "complete", requestId: parsed.data.requestId,
        }).returning({ id: messages.id });
        userMessage = createdUserMessage;

        const title = !prior && conversation.title === "New conversation"
          ? parsed.data.message.slice(0, 72)
          : conversation.title;
        await tx.update(conversations).set({ title, updatedAt: new Date() })
          .where(and(eq(conversations.id, conversation.id), eq(conversations.userId, user.id)));

        history = await tx.select({ role: messages.role, content: messages.content })
          .from(messages).where(and(eq(messages.conversationId, conversation.id), eq(messages.userId, user.id)))
          .orderBy(desc(messages.createdAt)).limit(40);
        history.reverse();
      }
      return { status: "ok" as const, conversation, userMessage, history, ...(editState ? { editState } : {}) };
    });
  } catch {
    return NextResponse.json({ error: "Conversation service is temporarily unavailable." }, { status: 503 });
  }

  if (setup.status === "not_found") return NextResponse.json({ error: "Conversation or message not found." }, { status: 404 });
  if (setup.status === "not_latest") return NextResponse.json({ error: "Only the latest user message can be edited. Earlier turns are preserved." }, { status: 409 });
  if (setup.status === "duplicate") return NextResponse.json({ error: "This request was already submitted. Refresh the conversation before sending another message." }, { status: 409 });
  const { conversation, userMessage, history } = setup;
  // Shared prompt and bounded-history construction keeps chat and regeneration aligned.
  const providerMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = buildProviderMessages(parsed.data.mode, history);

  const abortController = new AbortController();
  const unlinkRequestAbort = linkAbortSignal(request.signal, abortController);
  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await ai.client.chat.completions.create({
      model: ai.model,
      messages: providerMessages,
      stream: true,
      ...(ai.provider === "gemini" ? {} : { stream_options: { include_usage: true } }),
      max_tokens: env.SAMURA_MAX_OUTPUT_TOKENS,
    }, { signal: abortController.signal });
  } catch (error) {
    unlinkRequestAbort();
    const message = error instanceof OpenAI.APIError && error.status === 429
      ? "The AI provider is busy or the configured quota is exhausted. Please try again later."
      : "SAMURA could not reach the selected AI provider. Check that the model server is running and reachable, then try again.";
    await withUserTransaction(user.id, async (tx) => {
      await tx.insert(usageRecords).values({
        userId: user.id, conversationId: conversation.id, provider: ai.provider,
        model: ai.model, status: abortController.signal.aborted ? "cancelled" : "failed",
      });
      if (!setup.editState) {
        await tx.update(messages).set({ status: "failed" })
          .where(and(eq(messages.id, userMessage.id), eq(messages.userId, user.id)));
      }
    }).catch(() => undefined);
    return NextResponse.json({ error: message, persisted: !setup.editState }, { status: error instanceof OpenAI.APIError && error.status === 429 ? 429 : 502 });
  }

  const encoder = new TextEncoder();
  let fullText = "";
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let outcome = "complete";
      const emit = (payload: Record<string, unknown>) => controller.enqueue(encoder.encode("data: " + JSON.stringify(payload) + "\n\n"));
      if (!setup.editState) emit({ type: "user_message", id: userMessage.id });
      try {
        for await (const part of stream) {
          if (part.usage) { inputTokens = part.usage.prompt_tokens; outputTokens = part.usage.completion_tokens; }
          const text = part.choices[0]?.delta?.content;
          if (typeof text === "string" && text.length) {
            fullText += text;
            emit({ type: "delta", text });
          }
        }
        if (!fullText.trim()) outcome = "empty";
      } catch {
        outcome = abortController.signal.aborted ? "cancelled" : "failed";
      } finally {
        const responseSaved = await withUserTransaction(user.id, async (tx) => {
          let saved = false;
          let savedUserMessageId: string | undefined;
          const [lockedConversation] = await tx.select({ id: conversations.id })
            .from(conversations)
            .where(and(eq(conversations.id, conversation.id), eq(conversations.userId, user.id)))
            .limit(1)
            .for("update");
          if (lockedConversation && fullText.trim()) {
            if (setup.editState) {
              if (outcome === "complete" && !abortController.signal.aborted) {
                const current = await tx.select({ id: messages.id })
                  .from(messages)
                  .where(and(eq(messages.conversationId, conversation.id), eq(messages.userId, user.id)))
                  .orderBy(asc(messages.createdAt), asc(messages.id));
                const unchanged = current.length === setup.editState.snapshotIds.length
                  && current.every((item, index) => item.id === setup.editState?.snapshotIds[index]);
                const targetIndex = setup.editState.snapshotIds.indexOf(setup.editState.targetId);
                if (unchanged && targetIndex >= 0) {
                  const removeIds = setup.editState.snapshotIds.slice(targetIndex);
                  await tx.delete(messages).where(and(
                    eq(messages.conversationId, conversation.id),
                    eq(messages.userId, user.id),
                    inArray(messages.id, removeIds),
                  ));
                  const [replacementUser] = await tx.insert(messages).values({
                    id: userMessage.id,
                    conversationId: conversation.id,
                    userId: user.id,
                    role: "user",
                    content: parsed.data.message,
                    status: "complete",
                    requestId: parsed.data.requestId,
                  }).returning({ id: messages.id });
                  if (replacementUser) {
                    await tx.insert(messages).values({
                      conversationId: conversation.id, userId: user.id, role: "assistant",
                      content: fullText, status: "complete",
                    });
                    await tx.update(conversations).set({ updatedAt: new Date() })
                      .where(and(eq(conversations.id, conversation.id), eq(conversations.userId, user.id)));
                    saved = true;
                    savedUserMessageId = replacementUser.id;
                  }
                }
              }
            } else {
              const [newestMessage] = await tx.select({ id: messages.id })
                .from(messages)
                .where(and(eq(messages.conversationId, conversation.id), eq(messages.userId, user.id)))
                .orderBy(desc(messages.createdAt), desc(messages.id))
                .limit(1);
              if (newestMessage?.id === userMessage.id) {
                await tx.insert(messages).values({
                  conversationId: conversation.id, userId: user.id, role: "assistant",
                  content: fullText, status: outcome === "complete" ? "complete" : "partial",
                });
                saved = true;
              }
            }
          }
          await tx.insert(usageRecords).values({
            userId: user.id, conversationId: conversation.id, provider: ai.provider,
            model: ai.model, inputTokens, outputTokens, status: outcome,
          });
          return { saved, userMessageId: savedUserMessageId };
        }).catch(() => ({ saved: false, userMessageId: undefined }));
        unlinkRequestAbort();
        if (setup.editState && responseSaved.saved && responseSaved.userMessageId) {
          emit({ type: "user_message", id: responseSaved.userMessageId });
        }
        const responseUnsaved = Boolean(fullText.trim()) && !responseSaved.saved;
        try {
          if (responseUnsaved) emit({ type: "done", status: "unsaved" });
          else if (outcome === "failed") emit({ type: "error", message: setup.editState ? "The edit failed. Your previous messages were preserved." : "Generation stopped unexpectedly. Refresh the conversation to see any saved partial response." });
          else emit({ type: "done", status: outcome });
          controller.close();
        } catch { /* client cancelled the stream */ }
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(responseStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

