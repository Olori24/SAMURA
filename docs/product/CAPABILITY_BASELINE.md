# SAMURA AI Capability Baseline

**Snapshot branch:** `feat/chatgpt-capability-parity`
**Assessment date:** 2026-10-28
**Evidence level:** Source inspection only unless explicitly marked otherwise. This is not a live production verification.

## Confirmed in source

| Area | Source evidence | Current status | What remains to verify or build |
|---|---|---|---|
| Authentication | Better Auth session usage in chat; login redirect; sign-out | Implemented in source | Verify signup/login/reset flows against a deployed preview |
| Chat streaming | `src/app/api/chat/route.ts` streams deltas and persists assistant output | Implemented in source | Test browser behavior, cancel/partial persistence, retries, provider failure |
| Conversation persistence | `src/app/api/conversations/route.ts`, `src/app/api/conversations/[id]/route.ts` | Implemented in source | Rename/archive/delete, search message contents, export/share/fork are not confirmed |
| Conversation search | `src/app/chat/page.tsx` filters loaded conversation titles | Partial | Search is limited to the loaded list (API currently returns at most 100) and title search only |
| Copy response | `copyMessage` in chat page | Implemented in source | Browser permission and accessibility behavior need E2E verification |
| Stop generation | AbortController in chat page and API stream cancellation | Implemented in source | Verify abort and persisted partial response under real provider conditions |
| Chat/Code modes | Request schema and system prompt in chat route | Implemented in source | This is prompt-level mode selection, not a separate code execution sandbox |
| Markdown | ReactMarkdown + remark-gfm | Implemented in source | Add safe-link/rendering regression checks |
| Documents | Studio documents route and document APIs exist | Partial | Verify account persistence, formats, uploads, export and isolation |
| Image generation | Studio image UI and `/api/images/generate` route exist | Provider-dependent | Verify provider key/config, rate/cost limits, error behavior, and actual output |
| GitHub engineering | Studio GitHub engine/publish routes and connector OAuth endpoints exist | Partial | Test push/PR path end-to-end, user consent, branch safety, failure recovery |
| Connector workspace | Studio connector catalog exists | Partial | A listed connector must not be presented as active until OAuth and action calls work |
| Usage accounting | `usageRecords` writes in chat API | Implemented in source | Verify accuracy, limits, provider-specific usage and user-visible usage controls |
| Database access isolation | User-scoped queries and transaction helper | Implemented in source | Verify production runtime role, RLS configuration, migrations and cross-user negative tests |
| Security/legal docs | Draft policies and remediation plan in docs | Draft only | Legal review required; do not publish drafts without approval |

## Not yet evidenced as complete

- Edit a sent message and regenerate from that point
- Regenerate an assistant answer using a persisted, correct request history
- Rename, archive, delete, and restore conversations with ownership enforcement
- Search message content across all accessible conversations
- Share links with visibility/revocation controls
- Conversation branching/forking
- File upload/preview and robust extraction for PDF, spreadsheets, presentations, and images
- Retrieval grounded in user files with page/section citations
- Sandboxed code/data analysis and chart/artifact generation
- Web search with source-backed citations and multi-step research
- Projects with instructions, files, and isolated project context
- User-controlled durable memory and deletion controls
- Voice conversation, transcription, and speech output
- Image understanding/editing beyond any configured provider's actual capabilities
- Custom assistants with tools, knowledge, sharing and versioning
- Permissioned agent execution with approvals and auditable verification
- Scheduled tasks/reminders with reliable scheduler and delivery channel
- User data export and deletion workflow
- Full accessibility and end-to-end test coverage
- Successful preview deployment and production-like smoke test

## Evidence rules

- “Source present” means the code exists, not that the workflow has been exercised successfully.
- “Automated-tested” requires relevant tests to pass.
- “Preview-verified” requires a working non-production deployment and recorded end-to-end test.
- Provider-dependent functionality must identify required credentials, external costs, supported model capabilities, and graceful failure behavior.
- Never label the overall product fully complete while a critical capability or deployment blocker remains unresolved.


## Current evidence snapshot — 2026-10-30

**Source commit:** `5051750eaa5339ba8a0b4dab0eafca6b5e0d438e` on `feat/chatgpt-capability-parity`.

- GitHub Actions SAMURA CI passed dependency installation, configured dependency security audit, TypeScript typecheck, lint, unit tests, and production build: https://github.com/Olori24/SAMURA/actions/runs/41091538317
- Vercel produced a READY preview for this exact commit: https://samura-ojr6b0841-bakande11-2779s-projects.vercel.app
- Vercel's 24-hour runtime-error query returned no errors. This is not a substitute for browser E2E tests or Sentry ingestion.
- Automated preview browsing remains blocked by deployment access protection, so authenticated signup, chat, voice, image, research, GitHub OAuth/publish, and persistence journeys are not marked E2E-verified.
- Conversation rename/archive/restore/delete, latest-turn edit, server-side regenerate, Markdown export, and cursor-based older-message loading are present in source. They still require authenticated browser acceptance tests.
- CSV analysis runs locally in the browser; parser behavior, numeric summaries, and unique header naming have unit coverage. Chart rendering and summary export are implemented but do not yet have dedicated browser/component tests. It does not upload the selected file.
- Image generation and web research are implemented as provider-dependent routes, but the Vercel environment inventory did not contain `SAMURA_IMAGE_API_KEY` or `SAMURA_WEB_SEARCH_API_KEY`; neither capability is confirmed operational.
- Browser dictation is not full voice conversation, speech output, or realtime audio.
- Projects, durable user memory, broad file extraction/citations, sharing/forking, scheduled tasks and permissioned agent execution remain incomplete.
- The GitHub publish workflow is implemented in source, but preview OAuth is not configured with a GitHub client secret, and the protected preview prevents end-to-end confirmation.
- The application repository and Vercel environment inventory do not show Sentry or PostHog SDK configuration. The connected PostHog project reported no ingested events and no events seen in the last 30 days. Do not claim app-level monitoring or analytics are active.

**Release boundary:** this evidence is from a feature-branch preview only. No merge to `main`, production deployment, production database change, or production secret change was performed.
