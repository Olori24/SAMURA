# SAMURA Architecture

## Status
Phase 1 implementation is in PR #2 and remains pending verification. This document distinguishes code in the branch from integrations that have not been run against real credentials.

## Application shape
Use a modular monolith. The Next.js application hosts the product UI and server routes. PostgreSQL is accessed through Drizzle ORM and the Neon serverless driver. Better Auth manages email/password identity and sessions. The initial model adapter calls the OpenAI chat completions streaming API server-side.

## Current modules
- Identity: Better Auth route handler and browser client.
- Persistence: Drizzle schema and PostgreSQL migration.
- Conversations: authenticated create/list/detail endpoints with owner-scoped queries.
- Inference: OpenAI adapter with server-only key, bounded context, streaming, cancellation, and normalized pre-stream errors.
- Usage: provider/model/outcome records; token and exact cost values are left unset when not available.
- UI: responsive chat and login/signup experience.

## Data and trust boundaries
- The server is authoritative for user identity and resource ownership.
- Conversation and message lookups include the authenticated owner identifier.
- Provider credentials remain server-side.
- User prompts and provider output are untrusted text.
- Markdown does not enable raw HTML.
- Requests have schema and size checks; the deployment layer must also cap body sizes.
- The initial rate limiter is process-local and is not a distributed quota system.

## Persistence and migrations
Schema is defined in src/db/schema.ts. The initial SQL migration is in drizzle/0001_samura_core.sql; migration metadata is in drizzle/meta/_journal.json. Configure SAMURA_DATABASE_URL with a managed PostgreSQL connection string. Review and test migrations against a non-production database before applying them elsewhere.

## Provider gateway
The first adapter is OpenAI. SAMURA_OPENAI_MODEL configures the model identifier and defaults to gpt-4.1-mini; verify availability and billing for the actual account before enabling use. Provider calls fail clearly when OPENAI_API_KEY is absent. Do not treat mocks or unconfigured code as a live integration.

## Production gates
Before public launch: verify CI, lock dependency versions with a committed lockfile, test auth and tenant isolation against PostgreSQL, run a real authorized inference test, use shared rate limiting, configure email recovery/verification, and review production cookie/domain settings.
