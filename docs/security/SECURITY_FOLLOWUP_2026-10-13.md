# SAMURA Security Follow-up — 2026-10-13

**Scope:** Follow-up verification on PR #15, branch `feat/github-repository-inspection`.
**Commit assessed:** `9b5426f9dff95b33ef6c77a037c7b2623abb718b`.
**Production status:** No production database, authentication, or environment configuration was changed.

## Completed

### Full-history secret scanning

- Added `.github/workflows/secret-scanning.yml`.
- Runs on pushes, pull requests, and a weekly schedule.
- Checks out full history and runs Gitleaks with redacted output and all-ref/full-history Git log options.
- GitHub Actions check **“Scan Git history for secrets” passed** for the assessed commit.
- This means the configured scan reported no findings for the refs/history it scanned. It is not a guarantee that no credential was ever exposed outside the scanned Git history; rotate any credential suspected of prior exposure.

### Distributed rate-limit unit coverage

Added `src/lib/distributed-rate-limit.test.ts` to cover:
- Requests below the shared limit are allowed.
- Requests beyond the shared limit are rejected with a retry interval.
- Production fails closed when the shared store throws or database configuration is absent.
- The in-memory fallback is only used outside production.
- Invalid limits and empty store responses fail closed.

These are unit tests with a mocked database adapter. They do **not** replace the required integration test against a disposable Neon database with concurrent requests.

## Verification still in progress

At the time of this note, the normal CI job for commit `9b5426f9dff95b33ef6c77a037c7b2623abb718b` was still installing dependencies, and its unit-test/build results were not yet available. The Vercel deployment for that exact commit was still building. Do not treat either as green until the final check results are recorded.

## Remaining release blockers

1. Design and test a trusted transaction-scoped user identity and least-privilege database runtime role before enabling RLS. Production RLS remains disabled on the reviewed tables.
2. Configure and test verification and password-reset email delivery before requiring verified email.
3. Apply the shared rate-limit migration to a disposable preview database and verify atomic, cross-instance behavior.
4. Replace CSP's inline-script allowance with a tested nonce/hash policy.
5. Verify the deployed readiness endpoint, service-worker cache behavior, two-user authorization boundaries, session revocation, and OAuth state/replay protections.
6. Audit and normalize legacy Vercel environment-variable names without exposing or blindly copying production credentials.
7. Confirm exact-commit Vercel preview readiness and run authenticated runtime smoke tests.

**Decision remains: NOT CLEARED FOR PRODUCTION.** No merge or production promotion is authorized by this follow-up note.


## Password recovery implementation — 2026-10-13

Implemented on the PR branch:

- Added `src/app/forgot-password/page.tsx` and linked it from the sign-in page.
- Added `src/app/reset-password/page.tsx` with password confirmation, a 12–128 character limit, token removal from the visible URL after capture, and a generic invalid/expired-link path.
- Configured Better Auth password-reset tokens to expire after 60 minutes and revoke existing sessions after a successful reset.
- Added a rate-limit rule for password-reset requests.
- Added `src/lib/auth-email.ts` for Resend transactional email. It requires explicit server-side credentials, validates that reset links use the configured auth origin (HTTPS in production), escapes the HTML link, bounds the request with a timeout, avoids logging recipient/token/provider response bodies, and rejects untrusted reset URLs.
- Added route-level protection that returns a generic 503 for password-reset requests until delivery configuration exists, instead of pretending an email was sent.
- Added unit tests for email configuration, origin validation, HTTPS enforcement, provider failure handling, and request shape.

### Recovery delivery blocker

The current Vercel project configuration has no `RESEND_API_KEY` or `SAMURA_EMAIL_FROM`. The connected Resend account does not show a verified SAMURA-owned sending domain. I did not reuse another project’s sender domain, expose/create a provider API key, or change production environment variables.

Required before end-to-end recovery can be declared working:
1. Select a domain the owner controls for SAMURA transactional email and verify it in Resend.
2. Add `RESEND_API_KEY` as an encrypted/sensitive Vercel environment variable.
3. Add `SAMURA_EMAIL_FROM` using an address on that verified domain.
4. Configure the canonical `BETTER_AUTH_URL` and separate preview auth URL/database/secret correctly.
5. Test delivery, token expiry, one-time use, password update, and session revocation on a disposable preview account.

Until these credentials and a verified sender are available, the recovery UI is implemented but **email delivery is intentionally unavailable**. No production password or auth configuration was changed.
