# SAMURA Roadmap

## Phase 0 — repository foundation
- [x] Project charter and original SAMURA landing page.
- [x] Next.js / TypeScript application scaffold and health endpoint.
- [x] CI workflow and baseline architecture/security documentation.

## Phase 1 — secure persistent chat (PR #2, pending CI/review)
- [x] Better Auth email/password handlers and browser client.
- [x] PostgreSQL schema and initial migration for auth, conversations, messages, and usage records.
- [x] Owner-scoped conversation APIs.
- [x] Server-side OpenAI streaming adapter and request/usage controls.
- [x] Responsive chat workspace, session-aware entry flow, history restoration, and Markdown/GFM rendering.
- [x] Health and rate-limit unit tests added.
- [ ] Confirm GitHub Actions passes all checks.
- [ ] Apply migration to a test PostgreSQL database and verify auth/conversation flows.
- [ ] Run a live OpenAI inference test using an authorized key.
- [ ] Add deterministic dependency lockfile and validate deployment configuration.
- [ ] Review complete diff and security controls before merge.

## Phase 2 — context and memory
- [ ] Token-budgeted conversation context and long-thread summarization.
- [ ] User-approved memory CRUD and deletion.
- [ ] Project-scoped history and durable task continuity.

## Phase 3 — bounded agent runtime
- [ ] Typed tool registry, per-tool authorization, timeouts, and audit events.
- [ ] Checkpoints, idempotency, approvals for consequential actions, and explicit success criteria.

## Phase 4 — evaluation and economics
- [ ] Versioned evaluation set and quality/latency/cost baselines.
- [ ] Usage dashboards, budget enforcement, and regression checks.

## Phase 5 — model research
- [ ] Reproducible open-weight inference and fine-tuning experiments.
- [ ] License/provenance checks and compute estimates before training.

## Release gates
No public AI inference before authentication, tenant isolation, provider credential handling, rate limits, and failure paths are tested. No live integration, benchmark, training, or production-ready claim without corresponding evidence. The current in-memory limiter is not sufficient for horizontally scaled production.
