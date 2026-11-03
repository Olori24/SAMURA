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
| Conversation search | Chat sidebar and server-side search endpoint; searches conversation titles and message content | Implemented in source | Verify relevance, pagination and ownership isolation in authenticated browser tests |
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


## Historical evidence snapshot — 2026-10-30

**Historical only:** the preview URL, smoke checks and runtime observations below apply only to commit `c993e8484082317b1d95bb13ac16b6dccfaf4f1a`. They do not establish the state of later commits or the current feature-branch head.

**Source commit:** `c993e8484082317b1d95bb13ac16b6dccfaf4f1a` on `feat/chatgpt-capability-parity`.

- Vercel produced a READY preview for this exact commit: https://samura-1w3vp9f65-bakande11-2779s-projects.vercel.app
- The exact commit's Vercel status check is successful. Vercel build output completed and enumerated the application routes. No GitHub Actions workflow run was returned for this commit, so dependency audit, typecheck, lint and unit-test results are not claimed here.
- Public smoke checks returned HTTP 200 for `/api/health` and `/login`. The health endpoint reported `status: ok`. Authenticated browser journeys are not marked E2E-verified; protected API fetches could not be exercised through the temporary preview-access link.
- Vercel's selected 24-hour runtime-error query returned no errors. This is not a substitute for authenticated browser E2E tests or Sentry ingestion.
- Conversation rename/archive/restore/delete, latest-turn edit, server-side regenerate with usage accounting, Markdown export, and cursor-based older-message loading are present in source. They still require authenticated browser acceptance tests.
- CSV analysis runs locally in the browser; parser behavior, numeric summaries, unique header naming, quoted whitespace preservation, and explicit empty-record preservation have unit tests in source. Chart rendering and summary export do not yet have dedicated browser/component tests. It does not upload the selected file.
- Image generation now supports the existing Gemini API key through Google's Interactions API and the `gemini-nano-banana-2.1` image model, with OpenAI-compatible image providers retained as an override. No separate `SAMURA_IMAGE_API_KEY` is required when `GEMINI_API_KEY` is present only if `SAMURA_IMAGE_BASE_URL` is not configured. A custom compatible endpoint requires its own explicit `SAMURA_IMAGE_API_KEY`. The integration still requires a live authenticated generation test and may incur image-model charges. Official API reference: https://ai.google.dev/gemini-api/docs/image-generation
- Web research retains Tavily support and now includes Google Search grounding through Gemini 3.8 Flash. Because Google charges for executed search queries after its free allowance, this path is disabled by default and requires the explicit environment opt-in `SAMURA_GEMINI_GROUNDING_ENABLED=true`; the current Vercel environment does not contain a Tavily key or this opt-in. It is implemented but not active. Official pricing/behavior: https://ai.google.dev/gemini-api/docs/google-search/
- Browser dictation and browser text-to-speech are implemented. Full-duplex, realtime voice conversation is not implemented.
- Projects, durable user memory, broad file extraction/citations, sharing/forking, scheduled tasks and permissioned agent execution remain incomplete.
- The GitHub publish workflow is implemented in source, but preview OAuth is not configured with a GitHub client secret, and authenticated publish E2E remains unverified.
- Sentry and PostHog SDKs, initialization and event hooks are present in source. PostHog pageview ingestion is verified in the connected project; Sentry event ingestion remains unverified. PostHog currently reports no ingestion warnings but has active pageleave, web-vitals and authorized-URL health warnings. The feature branch now enables pageleave and web-vitals capture; the source fix must be deployed and checked before calling those warnings resolved.

**Release boundary:** this evidence is from a feature-branch preview only. No merge to `main`, production deployment, production database change, or production secret change was performed.


## Current source and CI evidence — 2026-11-03

**Feature branch:** `feat/chatgpt-capability-parity`  
**Source commit:** `a3abbe15eb39f5800fa4e789d1207b7f2d1eafa5`  
**Pull request:** [#36](https://github.com/Olori24/SAMURA/pull/36), open and unmerged.

**Automated verification:** GitHub Actions completed successfully for this exact source commit:
- SAMURA CI: mergeability check, dependency audit, TypeScript typecheck, lint, **176 unit tests across 27 test files**, and production build all passed.
- Security dependency validation: audit, TypeScript, lint, unit tests and production build passed.
- Secret scanning: passed across reachable refs.
- The latest source commit includes request-abort propagation tests and a broader GitHub engineering path allowlist that blocks all `src/app/api/` routes from model-generated patches.

**Deployment status:** Vercel rejected the feature-branch preview deployment because the account reached its daily API deployment limit. No preview deployment exists for source commit `a3abbe15eb39f5800fa4e789d1207b7f2d1eafa5`. Vercel indicated that deployment can be retried after the limit resets. An earlier branch preview reached READY, but it does not contain the latest fixes.

**Preview access and configuration:** SSO protection is enabled for Vercel deployments except custom domains; the project has only Vercel-managed domains. The feature branch lacks its own database/auth/GitHub OAuth preview variables, so authenticated end-to-end browser acceptance tests cannot currently be run against this exact head. Do not disable SSO or change production access without the owner's approval.

**Monitoring:** PostHog pageview ingestion has been confirmed in the connected project. Three health warnings remain: missing pageleave, missing web vitals, and no authorized URLs. Source fixes for pageleave and web-vitals capture are present in this branch but require deployment to verify; authorized-URL configuration requires owner confirmation. Sentry event ingestion remains unverified.

**Provider activation:** Tavily is not configured and Gemini Search grounding remains disabled by default. Enabling Gemini grounding may incur provider charges and requires an explicit operator decision. No provider spend was authorized as part of this work.

**Review state:** all 65 previous inline review threads are resolved. A fresh CodeRabbit review has been triggered for the current head; its findings are pending.

**Release boundary:** no merge to `main`, production deployment, production secret change, or destructive database operation has been performed. This is automated source/CI evidence, not a deployed preview or authenticated browser acceptance test.
