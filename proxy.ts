import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security-policy";

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const nonce = randomBytes(18).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  // Next.js reads the request CSP to attach this nonce to framework-generated
  // scripts. Forward both headers so the browser enforces the same policy.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    },
  ],
};
