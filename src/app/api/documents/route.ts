import { desc, eq } from "drizzle-orm";
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
const documentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  format: z.enum(["markdown", "text"]),
  content: z.string().max(MAX_DOCUMENT_CHARACTERS),
});

async function authenticatedUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Document service is not configured." }, { status: 503 });
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const result = await withUserTransaction(user.id, async (tx) => tx.select({
      id: userDocuments.id, title: userDocuments.title, format: userDocuments.format,
      createdAt: userDocuments.createdAt, updatedAt: userDocuments.updatedAt,
    }).from(userDocuments).where(eq(userDocuments.userId, user.id)).orderBy(desc(userDocuments.updatedAt)).limit(100));
    return NextResponse.json({ documents: result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load your documents right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) return NextResponse.json({ error: "Document service is not configured." }, { status: 503 });
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const rate = await checkDistributedRateLimit("documents-create:" + user.id, 30, 60_000);
    if (rate.unavailable) return NextResponse.json({ error: "Document service is temporarily unavailable." }, { status: 503 });
    if (!rate.allowed) return NextResponse.json({ error: "Too many document requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
    const body = await parseBoundedJson(request, MAX_DOCUMENT_CHARACTERS + 4096);
    if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Document is too large." : "Invalid JSON request body." }, { status: body.tooLarge ? 413 : 400 });
    const parsed = documentSchema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "Check the document title, format, and content." }, { status: 400 });
    const [created] = await withUserTransaction(user.id, async (tx) => tx.insert(userDocuments).values({
      userId: user.id, title: parsed.data.title, format: parsed.data.format, content: parsed.data.content,
    }).returning({
      id: userDocuments.id, title: userDocuments.title, format: userDocuments.format,
      content: userDocuments.content, createdAt: userDocuments.createdAt, updatedAt: userDocuments.updatedAt,
    }));
    return NextResponse.json({ document: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save your document. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
