import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { isPasswordRecoveryEmailConfigured } from "@/lib/auth-email";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);

function unavailable() {
  return NextResponse.json({ error: "Authentication is not configured on this server." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isRuntimeConfigured()) return unavailable();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) return unavailable();

  const pathname = new URL(request.url).pathname;
  if (
    pathname.endsWith("/request-password-reset") &&
    !isPasswordRecoveryEmailConfigured()
  ) {
    return NextResponse.json(
      { error: "Password recovery is temporarily unavailable. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return handlers.POST(request);
}
