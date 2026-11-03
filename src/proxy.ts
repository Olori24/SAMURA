import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function configuredPostHogOrigin(): string | null {
  const configuredHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!configuredHost) return null;

  try {
    const url = new URL(configuredHost);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function createContentSecurityPolicy(nonce: string): string {
  const connectSources = new Set([
    "'self'",
    "https://api.github.com",
    "https://o4511782206963712.ingest.us.sentry.io",
  ]);
  const posthogOrigin = configuredPostHogOrigin();
  if (posthogOrigin) connectSources.add(posthogOrigin);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://github.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `connect-src ${Array.from(connectSources).join(" ")}`,
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);

  // Next.js reads the request CSP to nonce its framework-generated scripts.
  // Forward the nonce separately for any application-owned script elements.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
    },
  ],
};
