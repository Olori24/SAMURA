import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { status: "not_configured", database: false, authTable: false },
      { status: 503, headers },
    );
  }

  try {
    // A read-only probe confirms the runtime connection and the exact table
    // Better Auth queries, without exposing records, credentials, or errors.
    await getDb().select({ id: users.id }).from(users).limit(1);
    return NextResponse.json(
      { status: "ok", database: true, authTable: true },
      { status: 200, headers },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: false, authTable: false },
      { status: 503, headers },
    );
  }
}
