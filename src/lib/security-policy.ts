/**
 * Build a per-request CSP. The nonce must be generated with a cryptographically
 * secure random source for each request and must never be reused.
 */
export function buildContentSecurityPolicy(nonce: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nonce) || nonce.length < 20) {
    throw new Error("A cryptographically strong base64 nonce is required.");
  }

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
    "connect-src 'self' https://api.github.com",
    "upgrade-insecure-requests",
  ].join("; ");
}
