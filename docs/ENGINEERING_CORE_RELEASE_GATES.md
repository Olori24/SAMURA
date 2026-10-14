# SAMURA Engineering Core — Regression and Release Gates

**Purpose:** protect the working chat experience while introducing repository-aware coding and controlled file changes.

## Current verification record

On 2026-10-15, the owner reported successful completion of all four production smoke checks:

- [x] Sign in successfully.
- [x] Create a new conversation.
- [x] Send a message and receive an AI response.
- [x] Refresh the page and confirm conversation history remains.

**Evidence classification:** owner-confirmed manual smoke test. This is not an independently captured browser test, a repeatable automated end-to-end test, or proof that every account/database/provider configuration works. Re-run these checks after a production deployment or changes to auth, database, chat, or provider code.

## Required regression checks

### Chat and persistence
- Sign-in, sign-out, and sign-in again with an existing account.
- Create a conversation; refresh; confirm it appears in history.
- Send a user message; confirm the AI response appears and survives refresh.
- Verify an unauthenticated request receives 401 from private APIs.
- Verify a second test user cannot list, read, or send messages to the first user's conversation.
- Confirm provider failures show a safe error and do not leak keys, SQL, or upstream response bodies.
- Confirm duplicate request IDs do not create duplicate user messages.

### Repository-aware coding
- No connected GitHub account: engine and publishing endpoints reject the request.
- Connected account: repository listing matches the connected GitHub identity and includes only repositories the token can access.
- Inspection is read-only and bounded by response, file, request, and timeout limits.
- Treat repository files, issue text, comments, and generated model output as untrusted data—not as instructions or authorization.
- Reject traversal, absolute paths, duplicate paths, binary files, credentials, environment files, lockfiles, workflows, deployment configuration, authentication/session code, and database schema changes.
- Verify the proposed patch is bound to the inspected base commit; reject publishing if the base branch moved.
- Publishing requires explicit user approval and creates a new branch plus a draft pull request. Never push generated changes directly to the base branch or auto-merge.
- Inspect the exact diff and test results before merging. A model-generated test plan is not evidence that tests ran.

### Files and documents
- Validate names, formats, size, and content before accepting an artifact.
- Treat uploaded or generated content as untrusted; never execute it implicitly.
- Keep private artifacts scoped to the authenticated owner.
- Use safe download headers and no-store caching for private content.
- Provide clear errors for unsupported formats and oversized content.
- Test export/open/round-trip behavior for each supported format before claiming that format is supported.

## CI release gate

Before merging engineering-core changes, verify the latest commit—not an earlier commit—has green results for:

1. Dependency installation and vulnerability audit.
2. TypeScript typecheck.
3. ESLint.
4. Unit tests.
5. Production build.
6. Full-history secret scan.
7. Vercel preview deployment.
8. Authenticated live smoke tests where the required test account, database, and provider configuration are available.

A green CI run does not prove production database policies, OAuth permissions, provider availability, or cross-user isolation. Record any test that cannot run and keep it as an explicit release blocker.

## Safe change policy

- Work on a feature branch and use a reviewable pull request.
- Preserve existing routes, schemas, and production data unless a reviewed migration is necessary.
- Do not change production secrets or database roles as part of an unrelated feature.
- No destructive operations, direct production writes, automatic merge, or code execution from a repository without a separate approval boundary.
- If a check fails, fix the cause and rerun the affected checks on the resulting commit.

## Known scope boundaries

Repository-aware patch generation and pull-request publishing are bounded text-file workflows, not unrestricted autonomous execution. Rename/delete operations, sandboxed test execution against arbitrary repositories, durable job recovery, and broad document-format conversion require separate implementation and security review.
