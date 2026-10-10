# SAMURA Architecture — Initial Decision

## Status
Proposed foundation, 2026-10-10. This document describes intended boundaries, not a claim that all subsystems exist.

## Initial shape
Use a modular monolith for the first milestones. A Next.js TypeScript application hosts the product UI and narrowly scoped server routes. Keep domain logic separated from UI and provider SDKs as features are added. Do not introduce distributed services before measured operational needs justify them.

Planned modules:
- Identity and authorization
- Conversations and messages
- Model gateway and provider adapters
- Context assembly and user-controlled memory
- Tool registry and bounded agent runtime
- File/artifact handling
- Usage accounting and budgets
- Evaluations, audit events, and observability

## Data and trust boundaries
- The server is the authority for user identity and resource ownership.
- Every conversation, message, file, memory, and task lookup must be scoped to the authenticated owner.
- Provider credentials remain server-side and are never returned to clients.
- User documents, model output, and tool output are untrusted input.
- Tools receive narrowly scoped permissions and validated schemas; consequential actions require approval.
- Avoid logging secrets, full sensitive prompts, or uploaded document contents by default.

## Provider gateway
Define a common internal interface only for capabilities that can be represented honestly. Adapters must advertise capabilities; unsupported tool calling, image input, structured output, or streaming must fail clearly rather than silently degrade. Provider identity and model identifier should be retained in usage metadata when available.

## Persistence
Select a relational database and migration system after checking the actual deployment environment and available credentials. Do not silently depend on a local filesystem for durable production state. Store uploaded files in a dedicated object store with size/type limits and access controls.

## Cost and resilience
Apply per-user rate limits, provider timeouts, cancellation, request-size caps, and usage accounting before exposing paid inference. Retries must be bounded and restricted to safe, idempotent operations. Any fallback must be explicit and observable.

## Deployment
Use environment-specific configuration, automated build/type checks, dependency review, and preview deployment before production. Health checks must not reveal credentials or internal topology. Keep secrets in deployment environment settings, not repository files.
