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


## Operational blocker: Neon preview branch exhaustion (verified 2026-10-28)

The Vercel deployment detail for the SAMURA feature branch shows the Neon integration failing at resource provisioning with: **“Branch limit reached. Upgrade your plan or delete unused branches.”** This is an integration provisioning failure, not evidence that the Next.js build failed.

The Neon integration product configuration explicitly states that preview deployments get their own database branches. Repeated Git pushes therefore repeatedly attempt preview-branch provisioning. Deleting branches is only temporary relief and can destroy branch-only data.

### Required permanent remediation

1. **Freeze destructive cleanup.** Do not delete or reset Neon branches to clear the limit until data ownership and any branch-only user data are checked.
2. **Inventory environment wiring without revealing secret values.** Record which database environment variables are integration-managed, their deployment targets, and which are manually managed. Never print or commit credentials.
3. **Confirm canonical production data.** Verify the production database URL resolves to the protected, primary Neon `main` branch and verify application data (users, conversations, messages, memory if implemented) before changing environment configuration.
4. **Provision one deliberate preview database.** It must be isolated from production and have stable credentials/URL. Verify schema migrations and test fixtures on it.
5. **Stop per-deployment preview database creation.** Adjust the Vercel–Neon integration/environment setup so previews use the stable isolated preview connection rather than provisioning a new Neon branch per deployment. Preserve production's existing connection and auth settings.
6. **Verify before removing the integration.** If disconnection is required, first confirm exactly which environment variables Vercel will remove or stop refreshing and stage replacements. Do not disconnect the integration or alter production variables until that dependency is known.
7. **Run persistence acceptance tests.** Create a test user and conversation on the preview environment, redeploy a second preview using the same stable preview database, and verify the data remains. Verify production data remains untouched.
8. **Only then clean up.** Archive/export any branch-only data first; delete only branches confirmed disposable.

### Acceptance criteria

- Feature-branch pushes no longer require a new Neon database branch.
- Preview uses a stable, non-production database.
- Production continues to use the same canonical database and retains all user data.
- Login, conversation history, memory persistence (if enabled), and migrations pass smoke tests after redeploy.
- The Vercel preview reaches Ready without a Neon branch-limit provisioning error.

**Current state:** root cause verified; permanent configuration change is not yet applied. No branches or production database settings were changed as part of this diagnosis.


### Latest infrastructure evidence (2026-10-28)

- Vercel's installed Neon integration is on its **Free** billing plan. The configuration's Neon product metadata explicitly says preview branches get their own branch.
- The Neon project inventory currently contains 10 branches. Besides protected primary `main`, the inventory includes branches created by Vercel for prior preview deployments; several are already archived. The current failure says the branch limit has been reached.
- The integration-managed Postgres variables (`DATABASE_URL`, `POSTGRES_PRISMA_URL`, `PGHOST`, etc.) are marked as integration-store secrets for production and preview. Their values must not be copied into source control or exposed in logs.
- A branch-specific restricted `SAMURA_DATABASE_URL` and auth settings also exist for the `security/rls-tenant-isolation` preview. This is an important warning against broad environment-variable edits: not every branch uses the same safe DB role.
- Vercel's connector-project API did not expose this Marketplace Neon resource as a connector; the Neon installation is a Marketplace integration configuration, not a generic Vercel connector. The available connected tools expose read/list operations for this configuration but no safe disconnect/reconfigure operation.

**Execution constraint:** do not modify production database variables or disconnect Neon automatically. The safe permanent change requires the project owner to disable the Neon integration's per-preview branch provisioning (if offered in integration settings) or disconnect the Marketplace integration after preparing stable direct Neon connection variables. Since disconnecting can affect integration-managed variables, it must be performed as a staged dashboard operation with the existing values preserved privately. Do not delete branches or upgrade billing without explicit user approval.

**Safe next action in Vercel:** open Project Settings → Integrations / Neon (or the installed Neon integration's resource settings) and disable per-preview branch provisioning if the integration exposes that setting. If it does not, stop here and prepare the stable isolated preview connection first; then disconnect the integration and add explicit preview-only variables. Leave production integration variables unchanged until the production direct connection is verified. Re-deploy the feature branch and verify it reaches Ready and that a test conversation survives a second deployment.
