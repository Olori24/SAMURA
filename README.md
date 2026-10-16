# SAMURA AI

![SAMURA logo](assets/brand/samura-logo.svg)

**Build useful intelligence. Earn trust. Grow capability.**

SAMURA is an independent AI engineering and research project focused on building a reliable AI platform through measurable engineering progress, responsible research, and useful products.

> **Current product:** SAMURA is deployed at [samura-ai.vercel.app](https://samura-ai.vercel.app). Deployment status alone does not mean every planned capability is complete; use the implementation, tests, and current configuration as the source of truth.

## Product direction

![SAMURA capabilities](assets/visuals/samura-capabilities.svg)

- **SAMURA Chat:** persistent conversations and model-provider integrations.
- **Provider gateway:** a server-side interface for supported AI providers.
- **Context and memory:** user-controlled continuity across conversations and projects.
- **Connectors and tools:** permissioned integrations with bounded execution.
- **Evaluation and research:** repeatable quality checks, observability, and cost controls.

Provider integration, operating a model, fine-tuning, and training a model from scratch are different capabilities. SAMURA will not present them as interchangeable.

## Architecture overview

![SAMURA architecture diagram](assets/diagrams/samura-architecture.svg)

## Engineering and security principles

- **Evidence over claims:** document only features, tests, and deployments that have actually been verified.
- **Server-side enforcement:** authenticate requests and authorize access on the server; never rely on UI visibility as an access control.
- **Tenant isolation:** protect user-owned records with application authorization and database safeguards, including row-level security where applicable.
- **Secret protection:** keep API keys, database credentials, OAuth secrets, and signing keys in managed server-side environment variables. Never commit secrets or expose them to browser bundles.
- **Abuse resistance:** apply appropriate rate limits, input validation, and safe error handling.
- **User control:** provide clear handling for saved data and account recovery.
- **Incremental architecture:** prefer small, testable changes over unnecessary service sprawl.

## Run locally

### Requirements

- Node.js 22 or later
- npm 10 or a compatible npm release
- A configured database and the required application environment variables
- An AI provider and model that the current application adapter supports

### Install and start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The development server may require configuration before authentication, database-backed features, or AI requests will work. Consult the environment-variable usage in the source and deployment configuration; do not copy production secrets into local files or commit a populated `.env` file.

## Environment and AI providers

Provider configuration is server-side. Configure only the variables used by the provider adapter in the current code.

### Ollama

For local inference, install [Ollama](https://ollama.com/download), pull a model supported by your installation, and configure:

- `SAMURA_AI_PROVIDER=ollama`
- `SAMURA_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1`
- `SAMURA_OLLAMA_MODEL` to the model you pulled, if required by the application

The exact model and supported features depend on the installed Ollama version and model. SAMURA's database, not Ollama, is responsible for SAMURA conversation persistence.

**Deployment note:** `127.0.0.1` inside a hosted server refers to that server/container, not your personal computer. A hosted deployment needs a reachable inference endpoint protected by network access controls and authentication. Do not expose an unauthenticated Ollama service to the public internet.

### OpenAI

Configure `SAMURA_AI_PROVIDER=openai`, `OPENAI_API_KEY` as a server-side secret, and `SAMURA_OPENAI_MODEL` to a model available to your account. Never place provider credentials in client-side code.

### Gemini

If the current provider adapter supports Gemini, configure `SAMURA_AI_PROVIDER=gemini`, `GEMINI_API_KEY` as a server-side secret, and `SAMURA_GEMINI_MODEL` to a model currently available to your project. Check Google's current [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), [model documentation](https://ai.google.dev/gemini-api/docs/models), and [OpenAI compatibility guide](https://ai.google.dev/gemini-api/docs/openai) before choosing a model. Availability, pricing, quotas, and data-use terms can change; do not assume that any provider or model is free or suitable for confidential data.

## Isolated terminal execution

Code mode runs requested commands in a fresh **Vercel Sandbox**, not in the SAMURA web process. Each command gets a short-lived sandbox with one vCPU, 2 GiB memory, outbound networking disabled, no application secrets forwarded, bounded runtime, bounded output, and best-effort cleanup.

The route uses the request-scoped `x-vercel-oidc-token` supplied by Vercel when Secure Backend Access / OIDC is enabled. For environments where that is unavailable, an administrator can configure a server-side `VERCEL_TOKEN` and the `SAMURA_VERCEL_PROJECT_ID` and `SAMURA_VERCEL_TEAM_ID` values. Treat `VERCEL_TOKEN` as a secret; never expose it to client code, prompts, logs, or sandbox environment variables. Prefer OIDC over a long-lived access token.

If authentication or project scoping is missing, execution reports `BLOCKED`. Sandboxed commands are untrusted workloads; network access stays disabled and commands must never receive production credentials. Verify Vercel Sandbox availability and billing/usage limits for the target account before enabling the feature for general users.


## Roadmap

![SAMURA roadmap](assets/visuals/samura-roadmap.svg)

## Available scripts

```bash
npm run dev        # Start the development server
npm run build      # Build the production application
npm run start      # Start the built application
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript checks
npm test           # Run the test suite
npm run db:generate # Generate database migrations
npm run db:migrate  # Apply configured database migrations
```

Run relevant checks before submitting changes. Database migrations should be reviewed and tested against a safe environment before being applied to production.

## Production and security verification

Before treating a release as production-ready, verify:

- Authentication, session handling, and account recovery.
- Server-side authorization and tenant isolation for every user-owned resource.
- Connector OAuth state validation, token storage, and disconnect behavior.
- Content Security Policy and other security headers.
- Rate limiting, input validation, and safe production error responses.
- Database migration status and the privileges of the actual runtime database role.
- Build, typecheck, lint, and relevant automated tests.
- A real smoke test against the deployed environment.

A green deployment or a successful email-delivery event is useful evidence, but neither independently proves the complete security or account-recovery flow.

## Contributing

Follow this cycle:

`INSPECT → PLAN → IMPLEMENT → TEST → FIX → VERIFY → DOCUMENT`

Prefer focused, reviewable pull requests. Include the reason for a change, tests run, results, and any remaining limitations. Avoid destructive changes unless their impact and recovery plan are understood.

## Project status

The project is under active development. Planned areas include stronger provider abstraction, context and memory controls, permissioned tools, evaluations, observability, and research infrastructure. A roadmap item is not a claim that the feature is complete. Confirm current behavior in the code and tests.

Architecture decisions and security limitations should be documented alongside the implementation as those documents are introduced.
