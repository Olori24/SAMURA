# Phase 1 — Secure persistent chat

## Implemented in the feature branch
- Better Auth email/password handlers and browser client.
- PostgreSQL schema for authentication, conversations, messages, and usage records.
- Initial idempotent-style SQL migration plus Drizzle migration journal.
- Owner-scoped conversation list, create, and detail endpoints.
- OpenAI server-side streaming adapter with explicit provider/model headers, input bounds, per-user request throttling, cancellation propagation, partial-response persistence, and usage outcome records.
- Responsive chat and email authentication screens.
- CI enforces deterministic `npm ci` installs and a zero-advisory dependency audit.
- Automated rate-limit and health endpoint tests.

## Required environment
- `SAMURA_DATABASE_URL`: managed PostgreSQL URL (Neon is supported).
- `BETTER_AUTH_SECRET`: cryptographically random secret of at least 32 characters.
- `BETTER_AUTH_URL`: canonical application URL.
- `OPENAI_API_KEY`: authorized provider key.
- Optional `SAMURA_OPENAI_MODEL`, `SAMURA_MAX_REQUESTS_PER_MINUTE`, `SAMURA_MAX_INPUT_CHARS`, and `SAMURA_MAX_OUTPUT_TOKENS`.

Never commit actual environment values. Run migrations through the configured Drizzle migration command in a trusted environment after reviewing the SQL and confirming the target database.

## Important limitations / release gates
- No provider key or database credential is committed or assumed available.
- Live database and live provider behavior remain unverified until tested against authorized infrastructure.
- The in-memory rate limiter is a single-process safety net, not a distributed quota system; replace it with a shared atomic store before horizontally scaled public production.
- Email verification and password reset require a configured mail provider and are not enabled in this phase.
- Usage records capture provider/model and outcome; exact token/cost figures are not claimed when provider usage/pricing is unavailable.
- A committed npm lockfile is maintained by the repository workflow; CI validates it with `npm ci`.
- Current GitHub Actions checks pass on the verified head, including the production build and blocking dependency audit. Live integration gates remain open.
