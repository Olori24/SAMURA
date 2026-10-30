# SAMURA AI — Data Inventory and Lifecycle Review

Status: Preliminary engineering inventory. This is not a completed DPIA, legal determination, or confirmation of vendor settings.
Last reviewed: 2026-10-30.
Do not use this document as a public privacy notice until all unknowns are verified and counsel has reviewed it.

## Inventory method

Rows below identify data categories evidenced by the repository or requiring confirmation. "Verify" means the current deployment, vendor configuration, retention period or complete processing purpose has not yet been established. Do not infer provider settings from SDK usage alone.

| Data category | Evidence / likely source | Purpose to verify | Recipients / storage to verify | Retention / deletion question |
|---|---|---|---|---|
| Account identity (name, email, image, verification status) | src/db/schema.ts users table; Better Auth | Account creation, login and support | Neon database; email provider if used | What happens on account closure and legal retention needs? |
| Password credential material | accounts.password field; Better Auth email/password authentication | Password-based account authentication | Neon database; confirm hashing algorithm, parameters, upgrade path and access controls from deployed Better Auth configuration | Password changes, account deletion, hash retention in backups and incident impact |
| Sessions and authentication metadata | sessions table includes token, IP address, user agent and user ID | Session continuity, security and abuse prevention | Neon database; logs may also receive operational metadata | Expiry, logout, reset revocation and deletion schedule |
| OAuth accounts and provider credentials | accounts table includes access/refresh/id tokens and scopes; GitHub connector routes | Connect GitHub and perform user-authorised operations | Neon database and GitHub API | Revocation, disconnect, token expiry and deletion behaviour |
| Password-reset verification data | verifications table and Better Auth callbacks | Account recovery | Database and email service | Token expiry, single use, cleanup and log redaction |
| Prompts, conversations and messages | conversation/message tables and chat API routes | Provide conversation history and AI responses | Database and configured AI provider(s) | User deletion, retention period, model-provider retention and backup propagation |
| Uploaded/generated documents | user_document schema and document API routes | User document workflows | Database/object storage/provider destinations must be confirmed | Deletion, versions, backup lifecycle and third-party copies |
| AI usage and cost metadata | usage_record table | Service operations, usage measurement and cost estimation | Database and observability tools if exported | Metadata fields, identifiers, retention and aggregation |
| Rate-limit records | api_rate_limit table | Abuse prevention and throttling | Database | Expiry cleanup and whether keys contain personal information |
| Operational logs and error telemetry | Application, hosting and any connected monitoring services | Reliability, security and troubleshooting | Vercel, Sentry or other configured vendors must be verified | Payload scrubbing, retention, access, region and deletion limitations |
| Product analytics and cookies | Requires code/configuration and deployed-browser inspection | Product analytics and preferences if present | Analytics vendors must be identified from actual configuration | Cookie consent, identifiers, opt-out and retention |
| Support and outbound email | auth-email.ts and configured sender | Password recovery and service communication | Resend or configured email service must be verified | Message content, delivery logs, recipient rights and vendor retention |

## Required verification questions

1. Which AI providers and model endpoints are enabled in each environment?
2. Are prompts, uploaded files, outputs, identifiers or usage metadata transmitted to each provider?
3. What do current contracts and account settings say about retention, training, subprocessors and regional processing?
4. Which analytics, error monitoring, session replay, advertising or cookie tools are actually enabled?
5. What personal data is written to logs, traces, support tickets and CI artifacts?
6. What retention periods are implemented for account, session, verification, conversation, document, usage and security records?
7. How are account deletion and data export implemented, including storage, vendors and backups?
8. Are international transfers taking place, and what safeguards apply?
9. Does SAMURA offer features to children or process special-category/sensitive data in a way requiring additional safeguards?
10. Which entity determines processing purposes and means, and when is SAMURA acting as a processor for a business customer?

## Engineering rules

- Minimise collection and avoid logging prompts, message bodies, tokens, passwords, reset URLs or full request bodies by default.
- Keep password credential material separate from OAuth credentials and session tokens. Verify password hashing and access controls from the deployed authentication configuration; do not describe password hashes as OAuth tokens.
- Keep OAuth credentials server-side. For each persisted credential store, document the applicable at-rest encryption control, key management, rotation and deployment evidence. Treat missing or unverified controls as open risks. Never include credentials in client responses or diagnostics.
- Use authenticated identity from a verified session; never trust a client-supplied user ID for ownership.
- Prefer short, documented retention periods where compatible with product function, legal obligations and security needs.
- Make deletion workflows explicit about backups and external processors; do not promise immediate erasure from systems where it cannot be verified.
- Record policy version and acceptance only when necessary for a clear legal purpose; do not collect extra personal data merely to create audit evidence.
- Treat vendor documentation as necessary but insufficient: verify the actual account configuration and contracts.

## Completion criteria

This inventory is complete only when each row has an accountable owner, a verified purpose and lawful basis (as determined with counsel), actual vendor/location details, retention rule, deletion mechanism, user-rights path and evidence source.


## Telemetry verification — 2026-10-30

The SAMURA repository tree contains no Sentry or PostHog SDK/instrumentation files, and the Vercel environment-variable name inventory contains no Sentry DSN or PostHog project-key/host variables. The connected PostHog project reported `ingested_event=false`; its event schema listed no events seen in the last 30 days. Vercel's runtime-error query returned no errors in the preceding 24 hours, but that does not establish Sentry integration.

**Current conclusion:** application-level Sentry error capture and PostHog product analytics are not evidenced as active. Do not describe them as operational until SDK configuration and event/error ingestion are verified. Any future instrumentation must be reviewed for consent and transparency, collect only necessary events, exclude prompts/message bodies/files/secrets, redact request metadata, and provide appropriate user controls. No analytics instrumentation or new user tracking was enabled during this review.
