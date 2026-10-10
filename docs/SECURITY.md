# SAMURA Security Baseline

## Non-negotiable controls
- Authenticate every private API request.
- Authorize every resource operation server-side and scope database access by owner/tenant.
- Validate request bodies and parameters with schemas.
- Keep API keys in server-only environment variables or a managed secret store.
- Apply rate, concurrency, payload-size, and spending limits.
- Restrict uploads by size and permitted type; never execute uploaded files.
- Treat prompts, retrieved documents, and tool outputs as untrusted.
- Use a strict allowlist and per-tool permission model for agent actions.
- Require explicit confirmation for destructive, external, financial, or irreversible actions.
- Avoid sensitive content in logs; record security-relevant metadata and outcomes.
- Provide data export and deletion pathways as persistence features are introduced.

## Current state
The initial scaffold has no authentication, database, provider keys, chat persistence, or agent execution. The health endpoint is public and returns only non-sensitive service status. The landing page is informational only. These are known limitations, not completed security controls for a production AI service.

## Incident-ready practices
Document secret rotation and incident response before public launch. Revoke leaked keys immediately, preserve relevant audit metadata, assess exposure, and notify affected parties as required by applicable law.
