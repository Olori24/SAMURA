# SAMURA Roadmap

## Current milestone — repository foundation
- [x] Initialize repository charter.
- [x] Add TypeScript/Next.js application skeleton.
- [x] Establish original landing-page design tokens and responsive foundation.
- [x] Add a minimal non-sensitive health endpoint.
- [x] Document architecture direction and initial constraints.
- [ ] Run install, lint, typecheck, tests, and production build in a real CI environment.
- [ ] Confirm deployment target and environment variables.

## Next milestones
### 1. Identity and persistence
Choose an authentication approach compatible with the deployment target; implement server-verified sessions, relational schema/migrations, ownership enforcement, and cross-user access tests.

### 2. SAMURA Chat
Persist conversations/messages, add streaming and cancellation, Markdown/code rendering, retry/regeneration, history, export, and clear recovery states.

### 3. Provider gateway
Implement a mock adapter for deterministic tests and at least one live adapter when an authorized key and billing limits are configured. Add capability metadata, timeouts, normalized errors, and usage records.

### 4. Context and memory
Add token-budgeted context assembly, summarization, user-approved memory CRUD, deletion, and project-scoped task history.

### 5. Agent execution
Implement a permissioned tool registry, validated inputs, bounded steps, checkpoints, idempotency, approvals, audit records, and explicit success criteria.

### 6. Evaluation and economics
Create versioned test datasets, quality/cost/latency baselines, regression checks, budget enforcement, and operational dashboards.

### 7. Research
Review model/data licenses, create reproducible small-model inference and fine-tuning experiments, estimate compute before running, and preserve experiment provenance.

## Release gates
No public AI inference before auth, tenant isolation, usage limits, provider credential handling, and failure paths are tested. No claim of live integration or model training without run evidence. No production-ready claim until deployment, migrations, backup/restore, observability, and security review are complete.
