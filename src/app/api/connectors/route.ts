import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { connectorRegistry } from "@/lib/connectors/registry";

export const runtime = "nodejs";

export async function GET() {
  if (!isRuntimeConfigured()) {
    return NextResponse.json({ error: "SAMURA is not configured yet." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json(
    { connectors: connectorRegistry },
    { headers: { "Cache-Control": "no-store" } },
  );
}
