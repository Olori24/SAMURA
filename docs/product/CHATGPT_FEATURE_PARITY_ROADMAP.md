# SAMURA AI — ChatGPT Capability Parity Roadmap

**Status:** Active implementation; capabilities below remain targets until implemented and verified. This roadmap does not claim full ChatGPT parity.
**Target repository:** `Olori24/SAMURA`
**Working branch:** `feat/chatgpt-capability-parity`
**Product principle:** Build comparable user outcomes under SAMURA branding. Do not copy proprietary source code, trademarks, protected assets, or imply affiliation with OpenAI/ChatGPT.

## Outcome

Evolve SAMURA from a chat application into a dependable multimodal AI workspace: chat, research, files, data analysis, image and voice workflows, memory, projects, tools/connectors, and safe agentic execution. Preserve existing SAMURA authentication, conversation history, provider gateway, document handling, image endpoint, GitHub connector, security controls, and UI unless a change is required for a verified capability.

“Feature parity” means a documented, tested SAMURA implementation or a clearly labeled integration for each capability—not a promise that every ChatGPT model, proprietary backend, or hosted service can be reproduced exactly.

## Verified implementation notes

The following partial capabilities have been added on the working branch; they do not mean the broader categories are complete:

- Conversation rename, archive, archived-list retrieval/restore controls, delete, export to Markdown, and latest-turn edit/regenerate flows.
- Source-linked web research workspace and server-side capability-status registry.
- Browser-local CSV preview and basic numeric summaries with CSV export; this tool does not upload the selected file to the SAMURA server.
- CSV parser tests for quoted fields, BOM/duplicate headers, malformed quotes, row-width mismatch, and numeric summary calculations.

Re-verify the latest CI run and deployed preview before treating any change as release-ready. Voice, projects/memory, broad file extraction, charts, and full connector parity remain incomplete.

## Capability inventory and target acceptance criteria

### 1. Core chat and model selection
- Streaming responses, cancel generation, regenerate, edit-and-resubmit, continue response, copy, share/export, and reliable conversation history.
- Model/provider selector driven by server-side capability metadata; show availability and limitations accurately.
- Conversation search, rename, archive, delete, branch/fork, and multi-turn context management.
- Markdown, code, math, tables, citations where sources exist, and accessible rendering.
- Retry and graceful fallback for rate limits, provider outages, context limits, and malformed outputs.
- Acceptance: integration tests cover stream completion/cancellation, retry behavior, conversation CRUD, ownership isolation, and provider failures.

### 2. Files, knowledge, and data analysis
- Secure uploads with file-type/size limits, malware-aware handling where available, extraction, preview, and deletion.
- PDF, text, CSV/XLSX, JSON, and common document support; image understanding where the chosen model supports it.
- Retrieval over user-owned files with citations to document/page/section; explicit file scope and retention controls.
- Sandboxed data analysis for CSV/table operations, calculations, charts, and generated artifacts. Never execute arbitrary uploaded code in the application process.
- Acceptance: file parsing, quota enforcement, malicious input, tenant isolation, citations, retention, and sandbox escape tests.

### 3. Web search and research
- Explicit web-search tool with source links, dates, and answer-level citations.
- Multi-step research mode that plans searches, compares sources, flags uncertainty, and produces a traceable report.
- Domain restrictions, timeouts, source deduplication, prompt-injection defenses, and SSRF protection.
- Acceptance: citations resolve, source claims are attributable, unsafe URLs are blocked, and the app never represents an unverified answer as a sourced fact.

### 4. Image and creative workflows
- Image generation and, where supported by the selected provider, image editing/variation and image understanding.
- Prompt history, progress/error states, safe output handling, user-owned asset gallery, and deletion/export.
- Clearly show which provider/capability is available; do not imply native support when it is a third-party integration.
- Acceptance: provider contract tests, request limits, ownership checks, content-policy handling, and failure recovery.

### 5. Voice and real-time interaction
- Speech-to-text, text-to-speech, voice conversation, interruption/cancel, transcript, and audio upload where provider capabilities permit.
- Clear microphone permission, recording indicator, consent, retention, and deletion controls.
- Do not record in the background or claim real-time video/screen support unless implemented and tested.
- Acceptance: permission-denied, interrupted stream, transcription failure, and retention tests.

### 6. Projects, memory, and personalization
- Projects/workspaces with instructions, scoped conversations, uploaded knowledge, and project-level settings.
- User-visible saved memory: inspect, edit, disable, and delete; distinguish durable memory from current conversation context.
- Optional per-project instructions and isolated contexts; never leak memory or files across accounts.
- Acceptance: memory opt-in/control, deletion propagation, scope isolation, and cross-user regression tests.

### 7. Tools, connectors, and agent workflows
- Permissioned tool registry with schemas, descriptions, timeouts, audit logs, quotas, and per-connector access scopes.
- Connector marketplace/catalog for supported integrations; OAuth state validation, encrypted token storage, disconnect/revoke, and explicit consent.
- Agent mode: plan → request approval for consequential actions → execute bounded steps → verify result → provide audit trail.
- Code/GitHub workflows must distinguish read/inspect from write/push/merge/deploy; write actions require clear user authorization.
- Never allow a model to bypass authorization, execute arbitrary shell commands on the web server, expose secrets, or follow instructions embedded in untrusted files/web pages.
- Acceptance: authorization, prompt injection, replay, token revocation, idempotency, auditability, and action-approval tests.

### 8. Custom assistants and reusable workflows
- User-defined assistants with instructions, tools, selected models, knowledge files, visibility settings, and versioning.
- Shareable assistant/workflow pages with access control, report/disable abuse, and explicit disclosure of capabilities.
- Acceptance: permission tests for private/shared/public assets and safe tool configuration.

### 9. Study, writing, and productivity modes
- Guided learning mode with stepwise explanations, quizzes, practice, and user-selected difficulty.
- Writing workspace with draft/edit/revision workflows and export; document editing should preserve version history.
- Task/reminder workflows only when a reliable scheduler and notification channel are configured.
- Acceptance: mode-specific behavior tests, version recovery, timezone handling, and notification delivery tests.

### 10. User account, controls, and trust
- Authentication, account recovery, session management, export/delete account data, privacy controls, usage visibility, and transparent limitations.
- Safety policies, abuse reporting, rate limits, cost budgets, audit trails, and incident response.
- Draft legal documents must remain unpublished until reviewed for actual processing, providers, jurisdictions, and operating practices by qualified counsel.
- Acceptance: auth/reset flows, data export/deletion, retention enforcement, tenant isolation, security headers, and real deployed smoke tests.

### 11. Mobile, accessibility, and collaboration
- Responsive mobile experience, installable PWA where appropriate, keyboard navigation, screen-reader labels, reduced-motion support, and robust error states.
- Share links with revocation and clear public/private status; collaborative editing only when access control and conflict handling are implemented.
- Acceptance: responsive smoke tests, accessibility checks, share-link authorization, and revoked-link tests.

## Delivery order

### Phase A — Stabilize and inventory
1. Build a verified feature matrix from the current source, tests, environment variables, and live behavior.
2. Record provider/model capability matrix and required external services/costs.
3. Preserve current features and resolve the existing Vercel preview provisioning failure separately.
4. Define test fixtures, usage/cost limits, and acceptance checks before adding features.

### Phase B — Core experience
1. Finish conversation CRUD/search/edit/regenerate/cancel and streaming reliability.
2. Finish safe file upload, document citations, and scoped knowledge retrieval.
3. Complete image workflows already represented in the application.
4. Add user-facing memory and project scoping.

### Phase C — Research and productivity
1. Add source-grounded web search and multi-step research.
2. Add sandboxed data analysis and exportable artifacts.
3. Add writing/study modes and reusable custom assistants.

### Phase D — Multimodal
1. Add voice/transcription/speech output using configured services.
2. Expand image editing/understanding and other media only where a supported provider exists.
3. Add live interaction only after latency, consent, and cost requirements are validated.

### Phase E — Agents and integrations
1. Harden connector catalog, OAuth lifecycle, action permissions, and audit trail.
2. Add approval-gated agent plans and verification of completed actions.
3. Add further integrations only with explicit scopes and tested failure behavior.

### Phase F — Release hardening
1. Run unit, integration, security, accessibility, and end-to-end tests.
2. Verify database migrations and runtime least privilege in a safe environment.
3. Verify CSP and browser console behavior against the deployed preview.
4. Run a real smoke test; document unimplemented/unsupported items.
5. Do not merge or deploy production until the owner explicitly authorizes it.

## Engineering constraints

- Make changes on a dedicated branch and in small, reviewable commits.
- No destructive database changes, production role changes, production secret rotation, legal-policy publication, merge to main, or production deployment without explicit authorization.
- Never place provider keys in client bundles or logs.
- Use provider adapters and capability declarations rather than provider-specific assumptions in UI.
- Every feature must include failure states, loading states, observability, usage/cost controls, authorization, and tests.
- Do not claim feature completion based on a visible button or successful build alone; verify the end-to-end behavior.
- Keep CodeRabbit review, Sentry monitoring, and PostHog analytics in the workflow when their integrations are available and appropriately configured.

## Definition of done for each capability

A capability is “done” only when:
1. The user can complete the workflow from the UI.
2. The server validates authentication, authorization, inputs, quotas, and provider availability.
3. Data access and retention behavior are documented and tested.
4. Automated tests cover success, failure, abuse, and cross-user isolation.
5. Relevant telemetry exists without collecting unnecessary sensitive content.
6. The feature is verified in a deployed non-production environment.
7. Remaining limitations and required external credentials/costs are documented.
