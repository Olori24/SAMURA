# SAMURA Security Baseline

## Implemented in the Phase 1 branch
- Better Auth email/password flow with server-managed sessions and HttpOnly cookie configuration.
- Production check requiring a 32-character minimum Better Auth secret.
- Auth endpoint rate limiting and per-user in-process conversation/inference throttling.
- Server-side authentication checks on conversation and chat APIs.
- Conversation list/detail queries scoped to the authenticated user.
- Zod validation for conversation and chat request fields.
- Server-only provider key access and bounded prompt/output configuration.
- Parameterized database operations through Drizzle.
- Markdown rendered through ReactMarkdown without enabling raw HTML.
- SQL migration uses foreign keys, indexes, uniqueness constraints, and cascading ownership cleanup.

## Known gaps before public production
- In-memory throttling is process-local; use a shared atomic limiter for multiple instances.
- Email verification and password recovery require configured email delivery and are not enabled.
- No live database or provider credentials were supplied; real integration remains unverified.
- Add a committed lockfile and dependency audit.
- Test ownership isolation and authentication flows against a real test database.
- Add an explicit maximum request body limit at the hosting layer as well as application-level content checks.
- Review session cookie behavior behind the actual production proxy/domain.
- Add account deletion/export and operational secret-rotation runbooks before public launch.

## Non-negotiable controls
- Authenticate every private API request.
- Authorize every resource operation server-side and scope database access by owner/tenant.
- Validate request bodies and parameters with schemas.
- Keep API keys in server-only environment variables or a managed secret store.
- Apply rate, concurrency, payload-size, and spending limits.
- Restrict uploads by size and permitted type; never execute uploaded files.
- Treat prompts, retrieved documents, and tool outputs as untrusted.
- Require explicit confirmation for destructive, external, financial, or irreversible actions.
- Avoid sensitive content in logs; record security-relevant metadata and outcomes.
- Provide data export and deletion pathways as persistence features are introduced.

## Current truth
The Phase 1 branch contains the initial implementation, but CI, live PostgreSQL, live provider behavior, and production deployment have not yet been verified. Do not describe SAMURA as production-ready until those gates pass.
