import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { userDocuments } from "@/db/schema";
import { withUserTransaction } from "@/db/user-transaction";
import { auth } from "@/lib/auth";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { parseBoundedJson } from "@/lib/parse-bounded-json";
import { MAX_DOCUMENT_CHARACTERS } from "@/lib/document-utils";

export const runtime = "nodejs";
const idSchema = z.string().uuid();
const updateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  format: z.enum(["markdown", "text"]),
  content: z.string().max(MAX_DOCUMENT_CHARACTERS),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Document service is not configured." }, { status: 503 });
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const [document] = await withUserTransaction(session.user.id, async (tx) => tx.select({
      id: userDocuments.id, title: userDocuments.title, format: userDocuments.format, content: userDocuments.content,
      createdAt: userDocuments.createdAt, updatedAt: userDocuments.updatedAt,
    }).from(userDocuments).where(and(eq(userDocuments.id, id), eq(userDocuments.userId, session.user.id))).limit(1));
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    return NextResponse.json({ document }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load this document right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Document service is not configured." }, { status: 503 });
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const rate = await checkDistributedRateLimit("documents-update:" + session.user.id, 120, 60_000);
    if (rate.unavailable) return NextResponse.json({ error: "Document service is temporarily unavailable." }, { status: 503 });
    if (!rate.allowed) return NextResponse.json({ error: "Too many document saves. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    const body = await parseBoundedJson(request, MAX_DOCUMENT_CHARACTERS + 4096);
    if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Document is too large." : "Invalid JSON request body." }, { status: body.tooLarge ? 413 : 400 });
    const parsed = updateSchema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "Check the document title, format, and content." }, { status: 400 });
    const [updated] = await withUserTransaction(session.user.id, async (tx) => tx.update(userDocuments).set({
      title: parsed.data.title, format: parsed.data.format, content: parsed.data.content, updatedAt: new Date(),
    }).where(and(eq(userDocuments.id, id), eq(userDocuments.userId, session.user.id))).returning({
      id: userDocuments.id, title: userDocuments.title, format: userDocuments.format, content: userDocuments.content,
      createdAt: userDocuments.createdAt, updatedAt: userDocuments.updatedAt,
    }));
    if (!updated) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    return NextResponse.json({ document: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save this document right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Document service is not configured." }, { status: 503 });
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const [deleted] = await withUserTransaction(session.user.id, async (tx) => tx.delete(userDocuments)
      .where(and(eq(userDocuments.id, id), eq(userDocuments.userId, session.user.id)))
      .returning({ id: userDocuments.id }));
    if (!deleted) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not delete this document right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
