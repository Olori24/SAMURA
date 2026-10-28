# SAMURA AI — Phase 2 Privacy, Legal and Security Remediation Plan

Status: Working document; not a certification or completed audit.
Branch: chore/privacy-legal-risk-reduction
Baseline reviewed: repository main branch and available GitHub/Vercel metadata on 2026-10-28.
Scope: repository review and non-destructive validation. No production changes authorized by this document.

## Operating guardrails

- Preserve current product functionality, design, routes and customer data.
- Work on this branch; do not merge, publish policies, or deploy without explicit approval.
- Do not change production secrets, database roles, migrations, data, domains or traffic routing without a separate, specific confirmation.
- Never place secret values, customer content, tokens, production records or personal data in reports.
- Treat provider behaviour and legal applicability as unverified until checked against current authoritative terms and actual account settings.
- Record the exact command, environment, commit and outcome for every test. Distinguish not run, blocked, failed and passed.

## Initial evidence

- The project declares Next.js, TypeScript, Better Auth, Neon serverless PostgreSQL, Drizzle ORM, Zod and Vitest in package.json.
- Available scripts: npm run lint, npm run typecheck, npm test, npm run build.
- src/lib/auth.ts configures email/password authentication, a 12-character minimum password, a 128-character maximum, rate limits, one-hour reset-token expiry and session revocation on password reset. It does not currently set emailAndPassword.requireEmailVerification to true.
- src/db/user-transaction.ts sets a transaction-local app.user_id and sets ROLE samura_runtime only when SAMURA_RLS_ENABLED=true.
- drizzle/0004_user_data_rls.sql exists. Its coverage, grants and live production state must be inspected together before proposing any database change.
- src/proxy.ts constructs a nonce-based Content-Security-Policy. The actual deployed response headers and browser behaviour remain to be verified.
- The repository tree reviewed on main did not contain clearly named public Privacy Policy, Terms of Service, cookie policy or data-retention documents. This does not rule out external hosted pages.
- The latest 12 GitHub Actions runs reviewed included successful secret-scanning runs on main. A feature-branch CI run succeeded on 2026-10-16; current main CI needs a fresh run.
- Vercel metadata reports `live=false`; the verified project domain list includes `samura-ai.vercel.app`. The latest preview deployment attempts on `chore/privacy-legal-risk-reduction` returned `BUILD_FAILED` with `Resource provisioning failed`. This is an infrastructure/provisioning error message, not evidence of an application compile failure. The currently served production response and deployment remain to be verified.

## Prioritised work plan

### P0 — Confirm the baseline without changing production
- [ ] Verify the custom production domain's current response and headers.
- [ ] Identify the currently serving deployment and commit.
- [ ] Read the newest main-branch CI results and deployment logs.
- [ ] Inspect all relevant RLS migrations, policies, grants and runtime-role configuration.
- [ ] Confirm which environment variable NAMES exist in Development, Preview and Production; never print their values.
- [ ] Inspect current Better Auth and password recovery tests.

### P1 — Security regression coverage
- [ ] Add or extend tests for cross-user conversation/document access denial.
- [ ] Verify account and GitHub connector token access is limited to the authenticated owner.
- [ ] Verify password-reset token expiry, one-time use and session revocation.
- [ ] Verify generic authentication responses do not leak account existence.
- [ ] Verify GitHub publish requires authenticated ownership, explicit approval and expected base commit.
- [ ] Verify production CSP headers and nonce behaviour on the live deployment.

### P1 — Privacy engineering and data lifecycle
- [ ] Inventory personal data, prompts, conversations, documents, OAuth tokens, analytics, error telemetry, email and infrastructure logs.
- [ ] Record purpose, applicable lawful basis, recipients, storage location, retention and deletion method for each flow.
- [ ] Confirm whether prompts or outputs are sent to third-party AI providers and review current contractual settings.
- [ ] Design user access, correction, export and deletion workflows as applicable.
- [ ] Define deletion propagation limits for vendors, backups and security logs.
- [ ] Assess controller/processor roles, international transfers, registration and DPO obligations with qualified counsel.

### P1 — Legal drafts (not for publication)
- [ ] Complete missing company identity and contact details.
- [ ] Confirm actual product features, data flows, retention, vendors, billing and user-rights processes.
- [ ] Draft Privacy Policy, Terms, Acceptable Use, AI disclosure, cookie/tracking disclosure and complaint process.
- [ ] Draft a customer Data Processing Agreement if SAMURA processes personal data on behalf of business customers.
- [ ] Obtain qualified legal review before publication.

### P2 — Release verification
- [ ] npm ci (or the repository's approved lockfile-based install) in an isolated workspace.
- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npm test
- [ ] npm run build
- [ ] Review dependency/security scan results.
- [ ] Compare policy statements with implementation and provider settings.
- [ ] Produce a final evidence-backed report with commit, diff, test output and unresolved issues.

## Initial risk register

| ID | Severity | Evidence / uncertainty | Next action |
|---|---|---|---|
| SAM-01 | High, pending verification | Email verification is not required in src/lib/auth.ts. Whether the product intends to require verified email is a product/security decision. | Verify email delivery and signup flows before enabling mandatory verification. |
| SAM-02 | High, pending verification | Conversation/message/usage and user_document RLS policies exist in migration source. RLS coverage for auth tables (user/session/account/verification), runtime-role grants, and live production migration state remain unverified. | Verify migration journal and deployed database read-only; test least privilege and cross-user access in an isolated database. |
| SAM-03 | High, legal readiness | No clearly named legal-policy files appeared in the reviewed repository tree. External pages not ruled out. | Confirm existing hosted policies and draft only after data mapping. |
| SAM-04 | High, release readiness | Vercel metadata showed live=false and recent deployment records showed errors; custom domain availability remains unverified. | Check active deployment, domain response and logs without promoting or rolling back. |
| SAM-05 | Medium | Legacy provider environment-variable alias exists in source; actual environment names/targets require read-only inventory. | Reconcile names without exposing values; do not remove aliases until dependencies are verified. |
| SAM-06 | Medium | Nonce-based CSP exists in src/proxy.ts; live headers and script behaviour are unverified. | Inspect deployed headers and browser console before editing CSP. |
| SAM-07 | Medium, pending verification | Full access/export/deletion and retention propagation have not yet been evidenced. | Map data lifecycle, then implement and test applicable workflows. |

## Current verification status

- Repository inspection: performed for selected files and metadata.
- Branch created: yes.
- Existing `drizzle/0005_user_documents.sql` was inspected after a duplicate migration draft was briefly added; the duplicate draft was removed from the branch before completion.
- Application tests executed in a controlled runtime: not yet.
- Production database or secrets changed: no.
- Public policies published: no.
- Main branch merged or production deployed: no.
- Legal approval: not obtained.

## CI evidence from Phase 2 branch (2026-10-28)

- The first branch CI run completed dependency installation and failed the dependency audit before typecheck, lint, unit tests, or production build could run.
- Audit output reported 3 vulnerabilities: 1 critical affecting the installed Next.js range 16.0.0–16.4.0 (GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr) and 2 high findings including Zod memory exhaustion (GHSA-mrhx-c7xc-m3w5). The audit report says the straightforward Zod fix would force Zod 4, a breaking major-version change. Do not apply a blind forced dependency upgrade; first review the current lockfile, compatibility, and vendor advisories, then update and test on this branch.
- CI was adjusted so typecheck, lint, unit tests, and production build still execute after the audit step fails, while the overall workflow remains failed until the security audit passes. This prevents a dependency finding from masking unrelated regressions.
- The chat streaming response no longer returns `X-SAMURA-Provider` and `X-SAMURA-Model` headers. No UI consumer of those headers was found in the repository search; provider selection remains server-side. This is a limited metadata-disclosure reduction, not a substitute for broader security testing.
- Current CI run for the first pass: https://github.com/Olori24/SAMURA/actions/runs/40725461514. It failed at dependency audit, so no claim is made that typecheck, lint, tests, or build passed on that run.
