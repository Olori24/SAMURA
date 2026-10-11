# SAMURA AI Security Hardening — 2026-10-11

## Status
**Not production-cleared.** This change set applies baseline browser security headers and enforces actual streamed request byte limits. It does not close every item in the full pre-deployment security checklist.

## Changes in this branch

1. `next.config.ts`: adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and production-only HSTS. These headers become active only after this branch is merged and deployed.
2. `src/lib/parse-bounded-json.ts`: reads JSON incrementally, caps actual bytes regardless of `Content-Length`, rejects malformed UTF-8/JSON, and cancels reading once the limit is exceeded.
3. `src/app/api/chat/route.ts`: uses the bounded parser with a 20,000-byte cap before schema validation.
4. `src/app/api/conversations/route.ts`: uses the bounded parser with a 4,096-byte cap before schema validation.
5. `src/lib/parse-bounded-json.test.ts`: covers valid JSON, oversized streaming bodies without a declared length, and malformed JSON.

## Remaining findings / release gates

### Critical — Application tables are absent from the connected Neon database
- **Severity:** Critical
- **Affected:** Neon project `noisy-shadow-16998197`, default branch `br-blue-shadow-b75r3shy`, database `neondb`; required public tables `user`, `session`, `account`, `verification`, `conversation`, `message`, and `usage_record`.
- **Evidence:** Read-only Neon inventory and `information_schema.tables` query on 2026-10-11 returned only tables in the `neon_auth` schema; no application tables exist in the connected database branch. The repository's Drizzle adapter expects application tables in the default schema.
- **Risk:** Authentication and chat persistence using the app's Drizzle schema cannot reliably work against this database until the expected application migrations are applied to the correct database. A successful build or generic health endpoint is insufficient evidence.
- **Required fix:** Confirm Vercel's `SAMURA_DATABASE_URL` points to this intended project/database; apply the committed application migrations to a staging branch first; verify table definitions and Better Auth adapter compatibility; then schedule the same migration against the intended production branch with a rollback/restore plan. Do not point the app at Neon Auth's `neon_auth` tables as a substitute for the app's own Better Auth schema.
- **Verification:** Query `information_schema.tables` and confirm all seven expected public tables exist; verify columns/indexes match `src/db/schema.ts`; run real signup/sign-in/session persistence and chat CRUD tests; prove cross-user reads/writes are denied.
- **Current state (2026-10-11):** User approved the migration. Applied the repository's existing `drizzle/0001_samura_core.sql` schema to Neon project `noisy-shadow-16998197`, database `neondb`, default branch `br-blue-shadow-b75r3shy`, using a temporary migration branch first. Verified all seven expected public tables, their columns, foreign keys/indexes, and `gen_random_uuid()` support on the temporary branch before applying. Re-queried the persistent branch after completion and confirmed all seven tables and expected indexes/constraints are present. No application data was deleted or modified. Remaining: verify the production app's effective database connection and run live signup/sign-in/chat persistence tests; schema existence alone does not prove end-to-end authentication works.


| Severity | Area | Current evidence and required action |
|---|---|---|
| High | Email verification | `src/lib/auth.ts` enables email/password auth but does not require verified email and no delivery callback is configured. Configure a real email sender, verification flow, and recovery flow; test delivery and token expiry before enabling the requirement in production. |
| High | Shared rate limits | `src/lib/rate-limit.ts` uses a process-local `Map`. Replace with an atomic shared limiter before multi-instance public launch; test cross-instance enforcement and 429 responses. |
| High | Database RLS / least privilege | Inspected migration does not enable RLS. Design policies together with a restricted runtime role and separate migration role; test cross-user read/write/delete using the real runtime role. Do not blindly enable RLS without a trusted per-request identity mechanism. |
| High | Secret hygiene | `.gitignore` excludes environment files, but a full scan of every Git ref/history and Vercel environment has not been run in this audit. Run Gitleaks or equivalent, inspect findings privately, and rotate any exposed credential. |
| High | Route authorization | Sampled chat/conversation routes require a session and owner-scope queries. A complete route inventory and anonymous/user/admin negative tests are still required. No admin role model was demonstrated in the sampled schema. |
| Medium | Database ownership | Application-level owner predicates are present in sampled routes; cross-user adversarial tests and live Neon grants have not been verified. |
| Medium | Session and password handling | Better Auth owns password hashing; verify the installed version's implementation and test persisted hashes, cookie attributes, expiry, logout/revocation, reset, and verification against staging. |
| Medium | Dependency audit / CI | CI is configured for `npm ci`, `npm audit --audit-level=low`, typecheck, lint, tests, and build. Require all checks green on this exact PR head before merge. |
| Medium | Production runtime | Confirm the intended Vercel deployment uses this exact commit; verify headers, cookies, auth, DB persistence, and real authenticated model inference. A READY deployment or health HTTP 200 is not proof of complete functionality. |
| Medium | XSS and query safety | Sampled routes use Zod and Drizzle query builders, and the chat UI uses React Markdown. Complete source-wide sink/raw-SQL search and payload tests remain pending. |
| Medium | Logs/errors | Sampled handlers avoid returning raw provider exceptions. Inspect all logs and failure responses for tokens, cookies, prompts, database URLs, provider keys, and stack traces. |
| Medium | Request/body limits | This branch adds actual stream-byte limits to chat and conversation creation. Verify the tests and add platform-level request limits as defense in depth. |
| Low | Health probe | The unauthenticated auth/database readiness endpoint returns limited configuration/table availability. Prefer a generic public liveness endpoint and keep detailed readiness information internal if operationally feasible. |
| Conditional | Uploads/webhooks | No upload or webhook endpoint was identified in the sampled routes. Re-check the complete route tree; if any exist, validate file bytes/size/storage safety or verify raw-body webhook signatures and replay protection. |

## Verification required before merge

- CI passes on this PR head: dependency audit, typecheck, lint, unit tests, and production build.
- Tests confirm an oversized body is rejected even without a `Content-Length` header and malformed JSON returns 400.
- Preview returns the intended security headers; production HSTS is enabled only over HTTPS.
- Live staging tests cover signup, email verification/recovery, cookie/session lifecycle, cross-user isolation, rate limits, DB persistence, and an authenticated model response.
- Scan all Git history/refs and inspect deployment environment variables without printing secret values.

## Final decision

**NOT CLEARED FOR PRODUCTION.** The changes here reduce two concrete attack surfaces, but production clearance requires the unresolved gates above to be closed with evidence tied to the exact release commit.
