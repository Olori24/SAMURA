# SAMURA Application Security Audit — 2026-10-13

**Template version:** 1.0  
**Assessment type:** Targeted pre-deployment security audit  
**Confidentiality:** Confidential — contains security-sensitive information  
**Report date:** 2026-10-13  
**Assessment period:** 2026-10-13  
**Prepared by:** SAMURA engineering/security review  
**Application owner:** SAMURA Engineering  
**Environment assessed:** GitHub source (main and `feat/github-repository-inspection`), Vercel project configuration/environment-variable metadata, and available deployment/CI metadata  
**Decision:** **NOT CLEARED FOR PRODUCTION**

## 1. Scope and evidence

Reviewed the repository tree and source for authentication, session handling, API routes, Drizzle schema and SQL migrations, server environment parsing, provider integration, GitHub OAuth/token encryption, request validation, PWA service worker, security headers, CI workflows, package manifest, lockfile presence, security documentation, Vercel project settings and environment-variable *names/targets/types* (secret values were not intentionally retrieved for this audit), GitHub Actions run metadata, PR #15, and deployment status.

Reviewed the route inventory under `src/app/api`. No admin route, file-upload endpoint, or webhook receiver was present in the inspected tree. Therefore admin-specific authorization, upload content validation, and webhook-signature verification are not currently applicable to an identified route; re-audit if these features are introduced.

The current feature head before this audit was `f6778fd588d656c7404815ed35e1d404538f21d3`. GitHub Actions run 244 succeeded on that head for dependency audit, typecheck, lint, unit tests, and build. This does not validate live database behavior or the new audit fixes. The current PR preview deployment fails with `BUILD_FAILED: Resource provisioning failed` before useful build events/logs are returned. A successful production deployment exists for the unchanged main commit `74b08c960b98e3c7b845e29164d410e78638bdc8`.

This was a source/configuration review, not an independent penetration test. Live cross-account tests, effective database grants/RLS, runtime authentication flows, and complete Git-history secret scanning could not be proven from the available evidence.

## 2. Prioritized findings

### SAM-SEC-01 — Email verification is not required
- **Severity / risk:** High
- **Status:** Open; requires mail-delivery configuration.
- **Affected:** `src/lib/auth.ts`, `src/app/login/page.tsx`, Vercel email-delivery configuration.
- **Evidence:** `emailAndPassword.enabled` is true, but the Better Auth configuration does not require verified email and does not configure a verification-email delivery callback. The security documentation also identifies verification/recovery as incomplete.
- **Risk:** Unverified addresses can create accounts and may be used for abuse, impersonation, and account-recovery problems. Requiring verification without a functioning delivery provider could also lock out legitimate users.
- **Exact fix:** Configure a production mail sender and Better Auth verification/recovery callbacks first. Then configure `emailAndPassword.requireEmailVerification: true` and a verification callback with expiry and one-time use; configure password-reset delivery separately. Do not enable the requirement until delivery works.
- **Verification:** In a staging database, sign up with an unverified address and prove protected app APIs remain unavailable until verification; verify expiry, replay rejection, resend throttling, and password-reset token expiry. Confirm verified users can sign in and unverified users cannot bypass the check via direct API calls.

### SAM-SEC-02 — Row-level security is absent
- **Severity / risk:** High
- **Status:** Open; requires database identity/role design and migration.
- **Affected:** `drizzle/0001_samura_core.sql`, `drizzle/0001_auth_tables.sql`, `drizzle/0002_chat_tables.sql`, `drizzle/0003_distributed_rate_limit.sql`, `src/db/schema.ts`; tables include `conversation`, `message`, `usage_record`, `account`, and authentication tables.
- **Evidence:** The migrations define tables, foreign keys and indexes but do not enable RLS or create policies. The application uses a shared server-side database connection. Sampled API queries include owner predicates, but this is not equivalent to database-enforced RLS.
- **Risk:** A future query regression or an incorrectly scoped server-side operation could expose another user's conversations or encrypted connector credentials. A shared database role without request-bound identity cannot safely apply user-specific policies by itself.
- **Exact fix:** Before enabling RLS, establish a trusted transaction-scoped identity mechanism and a runtime role that is not the table owner and does not have `BYPASSRLS`. For user-owned tables, enable and force RLS and create `USING` and `WITH CHECK` policies comparing the owner column to a transaction-local user identity set only by trusted server code. Apply equivalent policies to `account` and any other user-owned sensitive tables. Keep migrations on a separate privileged role. Do not blindly enable RLS without policies or a reliable per-request identity propagation mechanism.
- **Verification:** Query `pg_class.relrowsecurity` and `relforcerowsecurity`; inspect `pg_policies`; verify the production runtime role lacks bypass privileges; run two-user read/update/delete/insert tests against the actual runtime role and prove cross-user operations are denied.

### SAM-SEC-03 — Several sensitive endpoints used per-instance rate limits
- **Severity / risk:** High (image-generation cost abuse); Medium for other affected endpoints.
- **Status:** Code fix committed to the feature branch; integration verification remains open.
- **Affected:** `src/app/api/images/generate/route.ts`, `src/app/api/conversations/route.ts`, `src/app/api/connectors/execute/route.ts`, previously using `src/lib/rate-limit.ts` and its process-local `Map`.
- **Evidence:** The limiter was process-local and therefore did not provide a reliable shared quota across serverless instances.
- **Fix applied:** These routes now call `checkDistributedRateLimit`, return `503` if the shared limiter is unavailable, and return `429` with `Retry-After` when a quota is exceeded. The changes are on `feat/github-repository-inspection`; they are not in production.
- **Verification required:** Apply `drizzle/0003_distributed_rate_limit.sql` to the intended staging database, test concurrent requests across separate instances, prove the count is atomic, verify cleanup, and confirm production fails closed when the store is unavailable. Also verify Better Auth's sign-in/sign-up limiter is effective across serverless instances; its cross-instance backing store has not been proven.

### SAM-SEC-04 — PWA service worker cached arbitrary same-origin GET responses
- **Severity / risk:** Medium
- **Status:** Code fix committed to the feature branch; automated regression test pending.
- **Affected:** `public/sw.js`.
- **Evidence:** The previous fetch handler cached every successful same-origin GET except `/api/`. That could cache authenticated pages or Next.js navigation/RSC payloads if these later include private data, and could preserve stale content after sign-out.
- **Fix applied:** Changed the worker to cache only the explicit public shell allowlist (`/`, the web manifest, and two public icons), skip query-string requests, and avoid caching arbitrary pages, API routes, or RSC payloads. Cache version is now `samura-shell-v2`.
- **Verification:** Add a service-worker test or browser test proving a private route and a `?_rsc=` request are never written to Cache Storage; confirm the old cache is removed on activation and offline fallback only serves the public shell.

### SAM-SEC-05 — Preview deployment is blocked, preventing security integration tests
- **Severity / risk:** High release blocker
- **Status:** Open; Vercel/Neon provisioning investigation required.
- **Affected:** Vercel project `samura-ai`, PR #15, feature branch `feat/github-repository-inspection`, Neon preview branch and shared-rate-limit migration.
- **Evidence:** The latest feature deployment fails with `BUILD_FAILED: Resource provisioning failed`; Vercel returns no useful build events. GitHub Actions succeeded on the previous feature head, so the Vercel error is not evidence of a source compile failure. The PR's Neon integration configuration has reported project selection without a selected project and no preview branch provisioned.
- **Risk:** The new shared rate limiter cannot be verified end-to-end. Merging without a working preview and migration verification could make production API requests fail closed with `503` if the new table is absent.
- **Exact fix:** Correct the Vercel/Neon Marketplace project selection and preview resource provisioning. Provision a disposable preview database branch; apply and verify the migration there; deploy the exact current PR head; test rate-limit writes and authenticated API behavior. Apply the production migration only in a separately approved change window with a recovery plan.
- **Verification:** Vercel preview reaches `READY`; the preview is running the exact current PR head; the shared limiter successfully inserts/increments rows; auth/chat/conversation/image/connector smoke tests pass. Do not merge or promote until these gates pass.

### SAM-SEC-06 — Production Content Security Policy permits inline scripts
- **Severity / risk:** Medium
- **Status:** Open.
- **Affected:** `next.config.ts`, `productionContentSecurityPolicy`.
- **Evidence:** The policy includes `script-src 'self' 'unsafe-inline'`. This weakens CSP's ability to mitigate script injection. The policy also allows inline styles.
- **Risk:** If a script-injection defect is introduced elsewhere, this policy offers weaker defense in depth than a nonce/hash-based policy.
- **Exact fix:** Generate a per-request nonce in Next.js middleware/proxy, pass it to the rendering pipeline, and use a nonce-based `script-src` (plus `strict-dynamic` where compatible) without `unsafe-inline`. Remove `unsafe-inline` from styles where the framework/components permit; otherwise document the remaining style exception. Test the actual production build before enforcement.
- **Verification:** Inspect response headers on the deployed app, confirm framework scripts carry the matching nonce, run CSP violation tests, and prove inline injected scripts are blocked without breaking sign-in, chat streaming, or PWA install behavior.

### SAM-SEC-07 — Public readiness endpoint reveals database/auth-table state
- **Severity / risk:** Low
- **Status:** Open hardening recommendation.
- **Affected:** `src/app/api/health/auth-db/route.ts`.
- **Evidence:** An unauthenticated GET distinguishes `not_configured` from `unavailable` and returns separate database/auth-table booleans.
- **Risk:** This discloses limited operational configuration to anonymous callers and can help an attacker fingerprint service readiness.
- **Exact fix:** Keep `/api/health` as the public liveness check and protect `/api/health/auth-db` with an internal health-check secret/network policy, or return a generic response externally while recording detailed readiness internally.
- **Verification:** Anonymous requests receive no database configuration details; authorized monitoring can still confirm readiness without returning rows or credentials.

### SAM-SEC-08 — Vercel environment variables contain legacy/duplicate names
- **Severity / risk:** Medium configuration-hygiene risk; no direct secret disclosure established.
- **Status:** Open inventory and cleanup required.
- **Affected:** Vercel project environment-variable configuration; code compatibility in `src/lib/env.ts`.
- **Evidence:** Metadata shows canonical variables alongside legacy or ambiguous names such as `Openrouter`, `Gemini_Api_Key`, and `SAMURA`, plus a variable whose name resembles an OAuth client identifier. Secret values were not included in this report. Some names are not consumed by the current typed environment parser; `Openrouter` is still explicitly accepted as a legacy fallback.
- **Risk:** Duplicate keys create uncertainty about which credential is active, increase rotation burden, and make accidental misconfiguration more likely. The presence of a variable alone does not prove a secret was exposed.
- **Exact fix:** Inventory references and targets for each key; move the OpenRouter credential to `OPENROUTER_API_KEY`, deploy and verify that the canonical name is read in each required environment, then remove the legacy fallback and unused aliases. Confirm the ambiguous `SAMURA` and client-ID-named variables with the owner before removal. Keep credentials as Vercel Sensitive/Secret variables, and do not copy values into logs or reports.
- **Verification:** Compare names/targets only, verify required variables are present in the intended environment, run a provider smoke test, confirm no required code reads legacy aliases, and remove confirmed-unused entries. Do not retrieve or print secret values for routine auditing.

### SAM-SEC-09 — Complete Git-history secret scan is not evidenced
- **Severity / risk:** High until the scan is completed; no leaked credential was confirmed in this review.
- **Status:** Open.
- **Affected:** All Git refs/history of the public repository `Olori24/SAMURA`, including branches, tags, and deleted-file history.
- **Evidence:** The current tree contains `.env.example` and `.gitignore` entries for `.env` files, and the inspected tree showed no committed real `.env` file. A connector-based historical secret-scanning endpoint was unavailable; source search results did not establish a full-history scan. Therefore it would be inaccurate to claim that history is clean.
- **Risk:** A credential committed and later removed may remain retrievable from Git history and could still be valid.
- **Exact fix:** Run Gitleaks or an equivalent verified scanner over all refs and full history in a controlled CI/secure environment, without publishing raw findings. Review every finding privately. Revoke/rotate any real exposed credential first; history rewriting alone does not invalidate it. Enable GitHub secret scanning/push protection where available and add a scheduled scan.
- **Verification:** Attach the scanner version, scan scope/commit range, timestamp, and redacted summary to a secure ticket. Confirm no unresolved true positives remain and verify any identified credentials were rotated. Do not paste secret values into this report or CI logs.

### SAM-SEC-10 — Live authorization, RLS, and operational behavior remain unverified
- **Severity / risk:** High release gate.
- **Status:** Open.
- **Affected:** `src/app/api/auth/[...all]/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/conversations/route.ts`, `src/app/api/conversations/[id]/route.ts`, `src/app/api/connectors/github/*/route.ts`, `src/app/api/images/generate/route.ts`, and the actual Neon runtime role.
- **Evidence:** Sampled private routes check the Better Auth session and the conversation endpoints scope queries by the authenticated user. GitHub connector rows are queried by both `userId` and provider ID, and token envelopes use AES-256-GCM. However, the full two-user adversarial test suite, production OAuth round trip, actual password-hash inspection, effective database grants, and cross-instance runtime tests were not available. No admin route or role model was found in the inspected route tree.
- **Risk:** Source inspection alone cannot prove that authorization and persistence work correctly against deployed infrastructure.
- **Exact fix:** Add automated anonymous/unauthorized tests for every private route; two-user ownership tests for conversations/messages/accounts; OAuth state/replay/session tests; session-cookie and logout/revocation tests; and runtime-role privilege/RLS tests. Keep admin capabilities absent until a server-side role model and authorization checks exist.
- **Verification:** Run tests against a disposable staging database and exact preview deployment. Confirm unauthenticated requests return 401/redirect, foreign-resource access returns 404/403, invalid state/replayed OAuth callbacks fail, cookies are HttpOnly/Secure/SameSite in production, and no API key appears in browser bundles or responses.

## 3. Controls observed

- `.gitignore` excludes `.env` and `.env.*`, while explicitly allowing `.env.example`.
- The inspected frontend uses Better Auth's client session mechanism; no localStorage/sessionStorage token persistence was identified in the reviewed authentication client.
- Provider credentials are read through server-only modules and are not intentionally prefixed with `NEXT_PUBLIC_`.
- Database operations in the sampled routes use Drizzle query builders or parameterized tagged SQL. No string-concatenated SQL query was identified in the reviewed files.
- Conversation list/detail and chat queries include owner scoping in the sampled handlers.
- Chat/connector errors are generally returned as sanitized messages rather than raw provider exceptions; the reviewed handlers do not intentionally log credentials.
- `react-markdown` is used without enabling raw HTML in the reviewed chat UI.
- Security headers include frame denial, MIME sniffing protection, referrer policy, permissions policy, production HSTS, and CSP.
- No upload or webhook route was present in the inspected route tree.
- Better Auth owns password hashing; the configured password minimum is 12 characters and maximum is 128. Actual persisted hash format was not verified against a live staging account.

## 4. Dependency, Git, logs, and storage limitations

- GitHub Actions run 244 passed `npm audit`, typecheck, lint, tests, and build on the pre-audit feature head. The audit changes require a new green run on the resulting head.
- The public repository tree contains a lockfile; a green prior dependency audit is not a substitute for checking the new head.
- The Vercel environment inventory was reviewed by variable name, target, and sensitivity type only; raw credentials are intentionally omitted.
- Full Git-history secret scanning could not be completed with the available connector capabilities.
- The Vercel runtime-log API rejected a seven-day query because the project's current plan retains a shorter runtime-log window. This is a logging-retention limitation, not evidence that no incidents occurred.
- No live object storage, upload route, webhook receiver, or separate admin subsystem was identified in the inspected source. Confirm any external services not represented in this repository separately.

## 5. Prioritized release plan

1. **Block release:** Resolve the Vercel/Neon preview provisioning failure and deploy the exact PR head to a disposable preview.
2. **Block release:** Implement and verify database RLS/least-privilege policy design; do not claim RLS protection until live policy tests pass.
3. **Block release:** Configure and test email verification/recovery before requiring verified email in production.
4. **Block release:** Complete full-history secret scanning and rotate any confirmed exposed credentials.
5. **Block release:** Verify the shared rate-limit migration and concurrent enforcement; check Better Auth rate limiting across instances.
6. **Required hardening:** Deploy the service-worker cache fix and test that private routes/RSC responses are never cached.
7. **Required hardening:** Replace CSP inline-script allowance with a nonce/hash policy and reduce the public readiness endpoint's information disclosure.
8. **Required hardening:** Normalize Vercel environment-variable names, verify target-specific values without exposing them, and remove confirmed-unused legacy aliases.
9. **Release verification:** Run anonymous access tests, two-user isolation tests, OAuth/session tests, security-header checks, and provider smoke tests against staging and the exact release commit.
10. **Release decision:** Require all checks green and all High findings closed or formally accepted by the authorized risk owner. Do not merge/promote while the preview deployment or database migration remains unverified.

## 6. Final decision and unresolved risks

**NOT CLEARED FOR PRODUCTION.**

The service-worker caching issue and three per-instance rate-limit call sites have been corrected on the feature branch, but those changes have not been verified by a new green CI run or a working Vercel preview. The production deployment remains on the unchanged main commit. High-priority unresolved risks are email verification/recovery, database RLS and least privilege, complete historical secret scanning, cross-instance rate-limit verification, and the broken preview provisioning path. CSP hardening, health endpoint information minimization, and environment-variable cleanup also remain open.

This report does not certify the application as secure. Reassess after remediation and record test evidence against the exact commit intended for production.
