# SAMURA AI

**Build useful intelligence. Earn trust. Grow capability.**

SAMURA is an independent AI engineering and research initiative named in honor of the founder's mother. Its long-term mission is to build an original, globally accessible AI platform through measurable engineering progress, responsible research, and reliable products.

## What SAMURA is building

1. **SAMURA Chat** — secure, persistent, streaming conversations.
2. **Intelligence Gateway** — a provider-independent interface for authorized model providers.
3. **Context & Memory** — transparent, user-controlled continuity across conversations and projects.
4. **Agent Runtime** — permissioned tools, checkpoints, bounded execution, and verified outcomes.
5. **Evaluation & Research** — reproducible quality measurement and a resource-aware path toward operating, adapting, and eventually training models.

SAMURA will identify third-party models accurately. Provider integration, model operation, fine-tuning, and training from scratch are distinct capabilities and will never be conflated.

## Engineering principles

- **Evidence over claims:** report only tests, integrations, and deployments that actually ran.
- **Secure by default:** server-side authorization, tenant isolation, secret protection, rate limits, and explicit approval for consequential actions.
- **Modular, not overdistributed:** begin with a well-structured application and extract services only when evidence justifies it.
- **Budget-aware:** meter usage, set limits, and do not assume APIs or infrastructure are free.
- **User control:** users can inspect and delete saved memories and export their data.
- **Original product:** use public documentation and established patterns; do not copy proprietary implementations or protected branding.

## Initial delivery sequence

1. Repository and architecture foundation.
2. Authentication, persistence, and security.
3. Streaming multi-provider chat.
4. Context, memory, and project continuity.
5. Bounded agent execution and tool permissions.
6. Evaluation, observability, and cost controls.
7. Open-weight model experiments and research infrastructure.
8. Production hardening and launch readiness.

## Architecture direction

Start as a modular monolith with explicit boundaries for the web UI, application API, provider adapters, conversation/context services, memory, tools, evaluations, and usage accounting. Select database, authentication, and deployment integrations based on the actual repository and available credentials rather than assumptions.

Architectural decisions belong in `docs/adr/`. Security expectations and known limitations must remain documented as the implementation evolves.

## Status

This repository is being initialized. The existence of this charter does **not** imply that chat, authentication, live provider calls, model training, or production deployment are already implemented. Track implemented capabilities, test evidence, and blockers in the project documentation.

## Contributing

Changes should follow:

`INSPECT → PLAN → IMPLEMENT → TEST → FIX → VERIFY → DOCUMENT`

Prefer small, reviewable increments. Protect user data, avoid destructive changes, and never commit credentials or environment files containing secrets.


## AI inference providers

SAMURA Chat uses a server-side provider adapter. The default provider is **Ollama** for local development, so a paid OpenAI API key is not required to run the chat integration locally.

### Local Ollama setup

1. Install Ollama from the official website: https://ollama.com/download.
2. Pull the configured model: `ollama pull qwen3:8b` (or set `SAMURA_OLLAMA_MODEL` to another compatible model).
3. Keep `SAMURA_AI_PROVIDER=ollama` and set `SAMURA_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1`.
4. Start the SAMURA app and send a test message.

Ollama's OpenAI-compatible API supports common chat-completion features, but feature support varies by model. SAMURA stores conversation history in its database; Ollama itself does not replace the SAMURA persistence layer.

### Deployment warning

A Vercel-hosted server cannot reach your personal computer through `127.0.0.1`. To use Ollama from a deployed SAMURA instance, run it on a reachable server or use a secure private network/tunnel, then set `SAMURA_OLLAMA_BASE_URL` to that server's API base URL. Do not expose an unauthenticated Ollama endpoint to the public internet. For production, add network access controls, authentication at a gateway, usage limits, monitoring, and capacity planning.

To use OpenAI instead, set `SAMURA_AI_PROVIDER=openai`, provide `OPENAI_API_KEY` as a server-side secret, and configure `SAMURA_OPENAI_MODEL`. No provider key belongs in browser code or source control.
