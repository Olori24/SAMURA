import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import {
  getPasswordRecoveryEmailConfigStatus,
  isPasswordRecoveryEmailConfigured,
} from "@/lib/auth-email";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);

function unavailable() {
  return NextResponse.json(
    { error: "Authentication is not configured on this server." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  if (!isRuntimeConfigured()) return unavailable();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  if (!isRuntimeConfigured()) return unavailable();

  const pathname = new URL(request.url).pathname;
  const isPasswordResetRequest = pathname.endsWith("/request-password-reset");

  if (isPasswordResetRequest) {
    const configStatus = getPasswordRecoveryEmailConfigStatus();
    const configured = isPasswordRecoveryEmailConfigured();

    // Boolean-only diagnostics: never log email addresses, tokens, URLs, or secrets.
    console.info("[auth] Password recovery request received.", {
      configured,
      ...configStatus,
    });

    if (!configured) {
      console.warn("[auth] Password recovery rejected by configuration preflight.");
      return NextResponse.json(
        { error: "Password recovery is temporarily unavailable. Please try again later." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const response = await handlers.POST(request);
      console.info("[auth] Password recovery handler completed.", {
        status: response.status,
      });
      return response;
    } catch (error) {
      // Log only the error class; exception messages can contain user-controlled data.
      console.error("[auth] Password recovery handler threw.", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      throw error;
    }
  }

  return handlers.POST(request);
}
