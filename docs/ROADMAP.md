# SAMURA Roadmap

## Phase 0 — repository foundation
- [x] Project charter and original SAMURA landing page.
- [x] Next.js / TypeScript application scaffold and health endpoint.
- [x] CI workflow and baseline architecture/security documentation.

## Phase 1 — secure persistent chat
- [x] Better Auth email/password handlers and browser client.
- [x] PostgreSQL schema and migrations for auth, conversations, messages, and usage records.
- [x] Owner-scoped conversation APIs, server-side provider adapter, and bounded request handling.
- [x] Responsive chat workspace, history restoration, and Markdown/GFM rendering.
- [x] CI: dependency audit, typecheck, lint, unit tests, and production build.
- [x] Owner-reported manual smoke test: sign-in, conversation creation, AI response, and history persistence all passed on 2026-10-15.
- [ ] Automate the full browser-level smoke test against a disposable preview environment.
- [ ] Verify two-user isolation and RLS/runtime-role behavior against a real test database.
- [ ] Verify provider behavior and account recovery using configured test credentials.
- [ ] Validate all production and preview deployment configuration against the actual hosting environment.

## Phase 2 — repository-aware engineering workspace (in progress; PR #23)
- [x] Inspect actual GitHub repository branches and bounded text-file context through the connected account.
- [x] Generate structured, reviewable source patches with path restrictions and explicit approval.
- [x] Publish approved changes on a new branch as a draft pull request; do not write to the base branch or auto-merge.
- [x] Bind proposed changes to the inspected base commit and reject stale branch state.
- [x] Add engineering-core regression and release-gate documentation.
- [ ] Complete live in-app GitHub OAuth, repository access, patch generation, and draft-PR publishing test.
- [ ] Add repeatable browser-level tests for the core engineering flow.
- [ ] Add isolated, resource-bounded test execution for supported repositories before any test result is treated as verified.
- [ ] Add durable task checkpoints, idempotent recovery, and auditable approval events.

## Phase 3 — documents and artifact workspace
- [x] Add authenticated local document editor with Markdown/plain-text export and bounded draft size.
- [ ] Add automated tests for filename normalization, export formats, and oversized drafts.
- [ ] Add AI-assisted document drafting using the configured server-side provider, with clear generation errors and spend controls.
- [ ] Add owner-scoped server persistence, list/open/delete controls, and export tests for saved artifacts.
- [ ] Expand formats only when their export/open behavior is tested.
- [ ] Never execute uploaded/generated files implicitly; do not expose provider credentials to the browser.

## Phase 4 — context and memory
- [ ] Token-budgeted conversation context and long-thread summarization.
- [ ] User-approved memory creation, review, editing, and deletion.
- [ ] Project-scoped history and durable task continuity.

## Phase 5 — bounded agent runtime
- [ ] Typed tool registry, per-tool authorization, timeouts, and audit events.
- [ ] Checkpoints, idempotency, approvals for consequential actions, and explicit success criteria.

## Phase 6 — evaluation and economics
- [ ] Versioned evaluation set and quality/latency/cost baselines.
- [ ] Usage dashboards, budget enforcement, and regression checks.

## Phase 7 — model research
- [ ] Reproducible open-weight inference and fine-tuning experiments.
- [ ] License/provenance checks and compute estimates before training.

## Release gates
A successful owner-reported smoke test is useful evidence but is not an automated regression test or a complete security audit. No public AI inference or autonomous code execution without authentication, tenant isolation, provider credential handling, rate limits, bounded execution, failure-path testing, and explicit authorization. No live integration, benchmark, training, or production-ready claim without corresponding evidence.

Before merging, verify the latest commit—not an earlier commit—has green dependency audit, typecheck, lint, unit tests, production build, and full-history secret scan. Verify the Vercel preview and perform authenticated smoke tests when test credentials and a safe environment are available. The distributed rate limiter must fail closed in production if its shared store is unavailable.
