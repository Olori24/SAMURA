import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRuntimeConfigured } from "@/lib/runtime-config";
import { getPasswordRecoveryEmailConfigStatus } from "@/lib/auth-email";

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
  const pathname = new URL(request.url).pathname;
  const isPasswordRecoveryRequest = pathname.endsWith("/request-password-reset");
  const requestId = isPasswordRecoveryRequest ? crypto.randomUUID() : undefined;
  const runtimeConfigured = isRuntimeConfigured();

  if (!runtimeConfigured) {
    if (requestId) {
      console.warn("[auth] Password recovery request blocked by runtime configuration.", {
        requestId,
        runtimeConfigured: false,
      });
    }
    return unavailable();
  }

  if (!isPasswordRecoveryRequest) {
    return handlers.POST(request);
  }

  const emailConfig = getPasswordRecoveryEmailConfigStatus();
  console.info("[auth] Password recovery request received.", {
    requestId,
    runtimeConfigured,
    emailConfig,
  });

  if (!emailConfig.configured) {
    console.warn("[auth] Password recovery request blocked by email configuration.", {
      requestId,
      emailConfig,
    });
    return NextResponse.json(
      { error: "Password recovery is temporarily unavailable. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await handlers.POST(request);
    console.info("[auth] Password recovery handler completed.", {
      requestId,
      status: response.status,
    });
    return response;
  } catch (error) {
    // Log only the error class. Request bodies, email addresses, tokens, URLs,
    // provider credentials, and exception messages must never enter logs.
    console.error("[auth] Password recovery handler threw an exception.", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
