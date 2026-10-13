import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizedHealthCheck(request: Request): boolean {
  const secret = process.env.HEALTH_CHECK_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!secret || secret.length < 32 || !authorization.startsWith(prefix)) return false;

  const supplied = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  // Detailed database readiness is for authorized monitoring only. Anonymous
  // callers receive no indication whether the database or auth tables exist.
  if (!authorizedHealthCheck(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }

  try {
    await getDb().select({ id: users.id }).from(users).limit(1);
    return NextResponse.json({ status: "ok" }, { status: 200, headers });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }
}
