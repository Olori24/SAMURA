# SAMURA AI — Pre-Deployment Security Audit

**Date:** 2026-10-11  
**Audited code reference:** `5129c52b749ec753ace954c9c5819b94d4b3fdf9`  
**Audit branch:** `security/pre-deployment-audit-2026-10-11`  
**Status:** NOT CLEARED FOR PRODUCTION. This is a code-based review of the files listed below, not a claim that live infrastructure or the entire Git object history has been exhaustively scanned.

## Executive decision

Do not promote a production release until the deployment branch is reconciled with `main`, email-verification policy is decided and implemented, shared rate limiting is configured, the database migration and isolation tests pass against the actual Neon database, and the live deployment is tested. The existing CI workflow includes dependency audit, typecheck, lint, tests, and build; historical results are not proof that this branch or current deployment passes.

## Findings

### SEC-01 — Release branch and deployed-code mismatch
- **Severity:** Critical (release integrity / assurance gap)
- **Affected:** Git refs, release process, Vercel deployment configuration.
- **Evidence:** The repository default branch `main` currently exposes the project charter commit `62080e8818dee015cbf77a6514b065818063eb13`. The reviewed application code is available at `5129c52b749ec753ace954c9c5819b94d4b3fdf9`, which is not the current default-branch tip.
- **Risk:** Changes can be audited or reviewed on a ref that is not the source of the deployed application. Future deployments may omit fixes or deploy unreviewed code.
- **Required fix:** Decide which ref is authoritative; merge/rebase the application implementation and security fixes into the intended release branch through a reviewed PR. Configure Vercel to deploy only the approved branch/commit. Do not force-push or rewrite history as part of this audit.
- **Verification:** Compare Vercel's deployed SHA with the approved merge commit; require green CI on that exact SHA and record the result.

### SEC-02 — Email verification is not enforced
- **Severity:** High
- **Affected:** `src/lib/auth.ts`, Better Auth configuration, email-delivery provider and account policy.
- **Evidence:** `emailAndPassword` enables password authentication but does not set `requireEmailVerification: true`; no verification-email sender is configured in the inspected auth file.
- **Risk:** Users can authenticate with an address they have not proven they control, enabling address impersonation and weakening account recovery/trust.
- **Required fix:** Configure a real server-side email sender and Better Auth's email verification flow; require verification before sign-in if that is the product policy. Do not enable the flag without a working delivery adapter and verified callback URL.
- **Example configuration direction:**
  ```ts
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  // Configure sendVerificationEmail using the chosen transactional
  // email provider; keep its API key server-only.
  ```
- **Verification:** Signup creates an unverified user; sign-in is denied until a valid, unexpired verification link is used; expired/replayed tokens fail; the delivery provider is tested in staging.

### SEC-03 — Rate limiting is process-local
- **Severity:** High for public launch
- **Affected:** `src/lib/rate-limit.ts`, `src/app/api/chat/route.ts`, `src/app/api/conversations/route.ts`, authentication rate limits.
- **Evidence:** Rate-limit counters live in a module-level JavaScript `Map`; the source itself documents that a shared atomic store is needed for multi-instance production.
- **Risk:** Serverless instances do not share counters; attackers can distribute requests across instances or bypass limits through cold starts. AI spend and credential-stuffing protection are therefore not reliable.
- **Required fix:** Replace application-level counters with a shared atomic Redis/Upstash (or equivalent) limiter. Apply IP-based limits to signup/sign-in and user+IP limits to chat, with explicit limits for streaming concurrency and account creation. Keep Better Auth's limits as an additional layer, not the only shared defense.
- **Verification:** Send concurrent requests across two instances and prove the shared limit is enforced; verify 429 and Retry-After behavior; test trusted proxy/IP parsing.

### SEC-04 — Database row-level security is not present in the migration
- **Severity:** High (defense-in-depth and tenant-isolation requirement)
- **Affected:** `drizzle/0001_samura_core.sql`; tables `conversation`, `message`, `usage_record`, and auth tables.
- **Evidence:** The inspected migration creates tables and owner indexes but contains no `ENABLE ROW LEVEL SECURITY` or policies.
- **Risk:** Current application queries often filter by authenticated `user.id`, but a future query missing that predicate could expose another user's records. Application filtering alone is not database-enforced isolation.
- **Required fix:** Design and test a database role/policy model before enabling RLS. The current Neon HTTP/Drizzle setup does not automatically set a trusted per-request database identity; do not add policies that assume a user setting is trustworthy or leave the runtime role as an RLS-bypassing owner. Use a restricted runtime role, transaction-scoped identity set only by trusted server code, and policies for each tenant-owned table. Keep migrations/admin operations on a separate privileged role.
- **Verification:** Apply policies in staging, run cross-user SELECT/UPDATE/DELETE tests directly through the runtime role, confirm the runtime role cannot bypass RLS, and verify migrations still work with a separate migration role.

### SEC-05 — Security headers were missing from Next.js config
- **Severity:** Medium
- **Affected:** `next.config.ts`.
- **Risk:** Without browser-enforced anti-framing, MIME-sniffing, and referrer protections, users have less protection against clickjacking and content-type confusion.
- **Change made on this audit branch:** Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, DNS prefetch control, and production HSTS. This is not yet merged or deployed.
- **Verification:** Build and deploy the branch to staging; inspect response headers on HTML and API routes. Confirm HTTPS and all subdomains are correctly configured before relying on HSTS. Revisit Permissions-Policy if microphone/camera features are intentionally added.

### SEC-06 — Chat request body limit can be bypassed when Content-Length is absent
- **Severity:** Medium
- **Affected:** `src/app/api/chat/route.ts`, `src/app/api/conversations/route.ts`.
- **Evidence:** Routes reject based on the `content-length` header, but then call `request.json()`. A missing or misleading length does not itself cap bytes read.
- **Risk:** Oversized bodies can consume server resources before schema validation; platform-level limits are not verified here.
- **Required fix:** Enforce a hard request-body cap at the platform/proxy and in application code by reading a bounded stream (abort after the cap) before JSON parsing. Return 413 for excess bytes. Do not rely on the header alone.
- **Verification:** Test missing Content-Length, chunked bodies, oversized JSON, malformed JSON, and normal requests; prove the server stops reading once the cap is crossed.

### SEC-07 — Production security headers need staging verification
- **Severity:** Medium
- **Affected:** `next.config.ts`, Vercel domain/TLS configuration.
- **Risk:** A configuration change in source is not effective until the intended deployment serves it. HSTS is only useful when HTTPS is correctly enforced.
- **Required fix:** Merge the header change through CI, deploy to a staging domain, and verify every response path. Consider a carefully tested Content Security Policy separately; do not add a brittle CSP without checking Next.js scripts, styles, and streaming behavior.
- **Verification:** Automated header assertions in CI and live `curl -I` checks against homepage, login, auth, chat, and health endpoints.

### SEC-08 — Public database readiness endpoint reveals operational state
- **Severity:** Low
- **Affected:** `src/app/api/health/auth-db/route.ts`.
- **Evidence:** Unauthenticated GET reports whether database configuration and the auth table are available. It does not return credentials or rows.
- **Risk:** Exposes a limited service-health signal useful for reconnaissance and permits unauthenticated probe traffic.
- **Required fix:** Prefer a generic liveness endpoint publicly; restrict detailed readiness checks to platform health checks or an internal/authorized path if external monitoring does not require the detail.
- **Verification:** Public endpoint reveals no database/table detail; internal readiness check still detects missing configuration and missing tables.

### SEC-09 — Session-cookie design looks reasonable, but needs runtime proof
- **Severity:** Medium until verified
- **Affected:** `src/lib/auth.ts`.
- **Evidence:** Cookie attributes are configured as HttpOnly, SameSite=Lax, and Secure in production; session duration is 14 days and cookie cache is 5 minutes.
- **Risk:** Source configuration does not prove the deployed cookies actually carry those attributes or that session revocation/rotation behaves correctly. A 14-day session is a meaningful persistent-session choice.
- **Required fix:** Verify Set-Cookie output on the deployed HTTPS origin, logout/revocation, expiry, rotation, CSRF behavior, and cookie-cache invalidation. Consider a shorter session lifetime for higher-risk accounts.
- **Verification:** Automated integration tests inspect cookie flags and prove revoked/expired sessions cannot call protected APIs.

### SEC-10 — Email verification, recovery and abuse controls require end-to-end tests
- **Severity:** Medium
- **Affected:** Better Auth signup/sign-in flows, `user`, `session`, `account`, `verification`.
- **Evidence:** Schema includes Better Auth's verification table and password field in account storage, but schema existence alone does not prove a safe operational flow.
- **Risk:** Broken or untested recovery/verification flows can enable account takeover or lock legitimate users out.
- **Required fix:** Test signup, duplicate email, weak/long password, sign-in, sign-out, session expiry, verification, password reset, token expiry/replay, and rate limiting in staging. Confirm Better Auth's password hashing implementation/version and never log or return password hashes.
- **Verification:** Integration tests pass against a real disposable database with a test email sink; verify persisted password data is a one-way hash and never plaintext.

### SEC-11 — No admin authorization model was demonstrated in inspected code
- **Severity:** High if admin functionality exists; otherwise informational
- **Affected:** Route inventory, role schema, authorization middleware/policies.
- **Evidence:** The inspected `user` schema has a `status` field but no explicit role/permission field. The reviewed API routes cover chat, conversations, and health. This review did not establish that admin routes exist or that the entire route tree was enumerated.
- **Risk:** If an admin UI or endpoint exists elsewhere, hiding the button is not access control; an ordinary user may call the route directly.
- **Required fix:** Inventory every route. For each admin route, require a server-side session and explicit server-side role/permission check. Add a constrained role/permission model with no client-controlled role assignment; default-deny privileged operations.
- **Verification:** Automated tests call each admin endpoint as anonymous, ordinary user, and admin; expect 401, 403, and success respectively. Test direct URL/API access independently of UI visibility.

### SEC-12 — Secret scanning and Git-history review are not complete
- **Severity:** High until verified
- **Affected:** Entire Git history, branches/tags, CI logs, Vercel environment variables, repository settings.
- **Evidence:** `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`. This protects future untracked files only; it does not prove historical commits contain no secrets. A full Git-object/history secret scan was not available in this connector pass.
- **Risk:** A previously committed credential remains exposed even after deleting the file in a later commit.
- **Required fix:** Run Gitleaks or an equivalent scanner over all refs/history, review findings privately, revoke/rotate every exposed key immediately, then rewrite history only if appropriate and coordinated. Enable GitHub secret scanning/push protection where available. Never include actual secret values in this report.
- **Verification:** Save a clean scan result for all branches/tags and repository history; inspect Vercel variables for public prefixes and ensure secrets are server-only. Rotate credentials regardless of whether a historical key is still active.

### SEC-13 — Live dependency audit must be rerun for the release SHA
- **Severity:** Medium until verified
- **Affected:** `package.json`, `package-lock.json`, `.github/workflows/ci.yml`.
- **Evidence:** CI runs `npm audit --audit-level=low`, typecheck, lint, tests, and build. Earlier historical results reported zero vulnerabilities, but that is not a current audit of this branch or deployment.
- **Risk:** Vulnerabilities or build/test regressions can be introduced after a prior green run.
- **Required fix:** Run `npm ci`, `npm audit --audit-level=low`, typecheck, lint, tests, and build on the exact release commit. Review fixes for breaking changes instead of blindly applying major upgrades.
- **Verification:** All checks are green on the release SHA; retain the audit output as a CI artifact without exposing environment values.

### SEC-14 — SQL injection defenses appear positive in reviewed routes
- **Severity:** No issue observed in reviewed code; verification incomplete
- **Affected:** `src/app/api/chat/route.ts`, conversation routes.
- **Evidence:** Reviewed database access uses Drizzle query builders and parameterized predicates such as `eq` and `and`, rather than string-concatenated SQL.
- **Risk remaining:** This conclusion applies only to inspected routes and does not cover uninspected code or raw SQL elsewhere.
- **Verification:** Search all source for `sql.raw`, string-built SQL, unsafe query execution, and unvalidated dynamic identifiers; add tests for hostile inputs.

### SEC-15 — Input validation is present, but output rendering and complete route coverage remain unverified
- **Severity:** Medium until verified
- **Affected:** Chat/conversation API inputs, Markdown rendering, all client components and API routes.
- **Evidence:** Reviewed chat and conversation endpoints use Zod schemas. The UI uses `react-markdown`; no explicit `dangerouslySetInnerHTML` was observed in the sampled page.
- **Risk:** Validation of selected endpoints does not establish protection of all endpoints or all render sinks.
- **Required fix:** Inventory every route and validate request body, query, params, and content type server-side. Keep raw HTML disabled in Markdown; avoid unsafe HTML injection and sanitize any intentionally supported HTML with a maintained allowlist sanitizer.
- **Verification:** Run XSS payload tests through chat content, titles, query parameters, and profile fields; confirm output is rendered as text and no script executes.

### SEC-16 — No upload or webhook route was found in the sampled route paths
- **Severity:** Informational / not applicable unless implemented elsewhere
- **Affected:** Full API route inventory.
- **Evidence:** The inspected chat/conversation/auth/health paths do not implement file uploads or webhooks.
- **Risk:** If such routes exist elsewhere, this sample does not establish file validation or webhook signature verification.
- **Required fix:** Enumerate all `src/app/api/**/route.ts` files. For uploads, enforce byte limits, MIME and file-signature checks, safe generated names, private storage and malware scanning where appropriate. For webhooks, verify raw-body signatures and replay/timestamp protections before processing.
- **Verification:** Tests reject spoofed MIME types, oversized files, traversal names, invalid signatures, and replayed webhook deliveries.

### SEC-17 — Database least privilege and RLS status require provider-side inspection
- **Severity:** High until verified
- **Affected:** Neon roles, grants, connection strings, `user`, `session`, `account`, `verification`, `conversation`, `message`, `usage_record`.
- **Evidence:** Source uses a single configured database URL. Repository code cannot prove the privileges of the actual Neon role or branch.
- **Risk:** A runtime credential with owner/superuser-like privileges can defeat isolation controls and magnify a SQL injection or application compromise.
- **Required fix:** Use a dedicated least-privilege runtime role and separate migration role; restrict grants and network/database access; rotate credentials if exposed; apply tested tenant policies.
- **Verification:** Inspect live grants/role attributes through authorized database administration and prove the runtime role cannot create/drop schema or bypass RLS.

### SEC-18 — Error handling avoids provider exception details, but config wording can be reduced
- **Severity:** Low
- **Affected:** `src/app/api/chat/route.ts`, auth and conversation endpoints.
- **Evidence:** Provider failures return generic messages and catches generally avoid sending raw exception text. Some client-facing messages name environment variables or mention database configuration.
- **Risk:** Configuration detail aids reconnaissance and confuses end users; operational details belong in protected monitoring.
- **Required fix:** Return stable generic error codes to clients; log only a correlation ID and sanitized category. Do not log request bodies, auth cookies, tokens, database URLs, or provider keys.
- **Verification:** Force database/provider failures and inspect responses and logs for secrets, raw exception details, prompts, and authentication material.

## Checklist status for the 25 requested controls

| Control area | Status from this review |
|---|---|
| Admin route authentication/authorization | Not proven; full route inventory required |
| Server-side authorization | Present in sampled chat/conversation queries; not all routes audited |
| User-owned record isolation | Owner predicates present in sampled routes; cross-user tests pending |
| Database RLS | Not present in inspected migration |
| Email verification | Not enforced in inspected auth config |
| Password hashing | Delegated to Better Auth; implementation/runtime verification pending |
| Browser token storage | Cookie attributes configured; browser/runtime inspection pending |
| Server-only API keys | Chat reads OpenAI key server-side; full bundle/env audit pending |
| Environment variable exposure | No `NEXT_PUBLIC_` secret found in sampled files; full scan pending |
| .env exclusion | Ignore rules present; history still needs scanning |
| Git-history secret scan | Not completed |
| Sensitive logging/errors | No raw provider exception returned in sampled chat handler; full log review pending |
| Parameterized queries | Drizzle query builder used in sampled DB routes |
| Server input validation | Zod used on sampled chat/conversation mutations; all routes pending |
| XSS | No direct issue proven in sample; full sink/payload tests pending |
| Upload security | No upload route found in sample; full route inventory pending |
| Webhook signatures | No webhook route found in sample; full route inventory pending |
| Rate limiting | Present but in-memory and not shared |
| Security headers | Baseline headers added on audit branch; deployment test pending |
| Least privilege | Live Neon roles/grants not inspected |
| API auth coverage | Sampled data routes require session; all routes pending |
| Production debug/error mode | No raw errors returned in sampled handlers; full config/log review pending |
| Dependency vulnerabilities | CI audit exists; rerun required on release SHA |
| Unused routes/packages/services | Cannot conclude without full route/import inventory |
| Exposed files/secrets/config | `.gitignore` present; full history/build artifact scan pending |

## Prioritized release gates

1. **P0 — Release integrity:** reconcile `main`, audit branch, and Vercel deployed SHA; green CI must match the intended release.
2. **P0 — Identity policy:** implement and test email verification and account recovery with a real email provider.
3. **P0 — Tenant isolation:** create and test RLS/least-privilege policy model; run cross-user authorization tests.
4. **P0 — Secret hygiene:** scan all Git refs/history and deployment configuration; rotate any exposed credentials.
5. **P1 — Abuse and cost controls:** shared atomic rate limiting, bounded request streams, and per-user/provider spend caps.
6. **P1 — Runtime security:** validate security headers, cookie flags, session revocation, and generic production errors on staging.
7. **P1 — Complete inventory:** enumerate all routes, dependencies, storage integrations, webhooks/uploads, client bundles, and environment variables.
8. **P1 — Evidence:** run CI and end-to-end tests against the exact candidate release, with live auth, persistence, and cross-user tests.

## Unresolved risks / evidence still required

- Full recursive source/route inventory and complete Git-history secret scan.
- Current Neon schema, migration application status, database role grants, and RLS behavior.
- Working email delivery, verification and recovery tests.
- Cross-user access tests against a real staging database.
- Shared rate limiter configuration and multi-instance abuse tests.
- Vercel production/preview environment variable review and deployed header/cookie inspection.
- Fresh dependency audit, build, lint, typecheck, and test results on the release SHA.
- Storage/upload/webhook controls if those routes exist outside the sampled paths.

**Final status: NOT CLEARED FOR PRODUCTION.** The header change on this branch is a limited remediation, not proof of overall security. Close the release gates above and re-audit the exact candidate commit before claiming the application is secure.
