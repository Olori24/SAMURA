import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { withUserTransaction } from "@/db/user-transaction";

export const runtime = "nodejs";
const createSchema = z.object({ title: z.string().trim().min(1).max(160).optional() });

async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET(request: Request) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  let failureStage = "authentication";
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    failureStage = "conversation_query";
    const archived = new URL(request.url).searchParams.get("archived") === "true";
    const rows = await withUserTransaction(user.id, async (tx) => tx.select({
      id: conversations.id, title: conversations.title, createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    }).from(conversations)
      .where(and(eq(conversations.userId, user.id), eq(conversations.archived, archived)))
      .orderBy(desc(conversations.updatedAt)).limit(100));
    return NextResponse.json({ conversations: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const candidate = error as { name?: unknown; code?: unknown };
    console.error("[samura:conversation-history] request failed", {
      stage: failureStage,
      errorName: typeof candidate?.name === "string" ? candidate.name.slice(0, 80) : "UnknownError",
      errorCode: typeof candidate?.code === "string" || typeof candidate?.code === "number" ? String(candidate.code).slice(0, 40) : undefined,
      rlsEnabled: process.env.SAMURA_RLS_ENABLED === "true",
      databaseUrlSource: process.env.SAMURA_DATABASE_URL ? "SAMURA_DATABASE_URL" : process.env.DATABASE_URL ? "DATABASE_URL" : "missing",
    });
    return NextResponse.json({ error: "Conversation service is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) {
    console.error("[samura:conversation-create] runtime configuration missing", {
      hasSamuraDatabaseUrl: Boolean(process.env.SAMURA_DATABASE_URL),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasBetterAuthSecret: Boolean(process.env.BETTER_AUTH_SECRET),
      hasBetterAuthUrl: Boolean(process.env.BETTER_AUTH_URL),
      rlsEnabled: process.env.SAMURA_RLS_ENABLED === "true",
    });
    return NextResponse.json({ error: "Conversation service is not configured." }, { status: 503 });
  }
  let failureStage = "authentication";
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    failureStage = "rate_limit";
    const limit = await checkDistributedRateLimit("conversation-create:" + user.id, 30, 60_000);
    if (limit.unavailable) return NextResponse.json({ error: "Rate limiting is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if (!limit.allowed) return NextResponse.json({ error: "Too many new conversations. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } });
    failureStage = "request_validation";
    const body = await parseBoundedJson(request, 4_096);
    if (!body.ok) return NextResponse.json(
      { error: body.tooLarge ? "Request is too large." : "Invalid JSON request body." },
      { status: body.tooLarge ? 413 : 400 },
    );
    const parsed = createSchema.safeParse(body.value ?? {});
    if (!parsed.success) return NextResponse.json({ error: "Invalid conversation details." }, { status: 400 });
    failureStage = "database_insert";
    const created = await withUserTransaction(user.id, async (tx) => {
      const [row] = await tx.insert(conversations).values({
        userId: user.id, title: parsed.data.title ?? "New conversation",
      }).returning({ id: conversations.id, title: conversations.title, createdAt: conversations.createdAt, updatedAt: conversations.updatedAt });
      return row;
    });
    return NextResponse.json({ conversation: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
    const safeMessage = typeof candidate?.message === "string"
      ? candidate.message.replace(/(?:postgres(?:ql)?:\/\/|https?:\/\/)[^\s"'<>]+/gi, "[redacted-url]").slice(0, 240)
      : "No error message available";
    console.error("[samura:conversation-create] request failed", {
      stage: failureStage,
      errorName: typeof candidate?.name === "string" ? candidate.name.slice(0, 80) : "UnknownError",
      errorCode: typeof candidate?.code === "string" || typeof candidate?.code === "number" ? String(candidate.code).slice(0, 40) : undefined,
      errorMessage: safeMessage,
      rlsEnabled: process.env.SAMURA_RLS_ENABLED === "true",
      databaseUrlSource: process.env.SAMURA_DATABASE_URL ? "SAMURA_DATABASE_URL" : process.env.DATABASE_URL ? "DATABASE_URL" : "missing",
    });
    return NextResponse.json({ error: "Could not create a conversation. Check database configuration." }, { status: 503 });
  }
}
