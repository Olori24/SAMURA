# Contributing to SAMURA AI

Thank you for considering a contribution. SAMURA is an early-stage AI engineering initiative; correctness, transparent status, and safe handling of user data matter more than the size of a change.

## Before you start

1. Read the [README](README.md), [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), and [security baseline](docs/SECURITY.md).
2. Search existing issues and pull requests before opening a duplicate.
3. For substantial work, open an issue or discussion first so scope and acceptance criteria are clear.
4. Do not begin work that requires secrets, production data, or external spending without explicit authorization.

## Development setup

Requirements and environment variables are documented in the README and [.env.example](.env.example).

~~~~bash
npm ci
cp .env.example .env.local
npm run dev
~~~~

Fill only the values needed for the task. Never commit .env.local, API keys, database URLs, user data, or copied production logs containing sensitive information.

## Engineering expectations

- Follow: **INSPECT → PLAN → IMPLEMENT → TEST → FIX → VERIFY → DOCUMENT**.
- Keep pull requests focused and reviewable.
- Preserve existing behavior unless a change is intentional and documented.
- Add or update tests for behavior changes, especially authorization and failure paths.
- Run the applicable checks before requesting review:

~~~~bash
npm run typecheck
npm run lint
npm test
npm run build
~~~~

- Update architecture, security, and roadmap documents when implementation status changes.
- State exactly what you tested. Distinguish unit tests, mocked tests, and live integration tests.
- Do not claim that an integration works merely because a client or adapter exists in the repository.
- Do not add a new dependency without explaining why it is needed and considering maintenance, security, and resource costs.

## Pull requests

Include:

- The problem and intended outcome.
- A concise summary of the implementation.
- Security, privacy, and migration implications.
- Commands/tests run and their actual results.
- Known limitations, follow-up work, and any environment setup required.

Do not bundle unrelated formatting or refactoring with functional changes. Never include credentials in a pull request.

## Bugs and feature proposals

Use the GitHub issue templates when available. Bug reports should include reproducible steps, expected and actual behavior, relevant environment details, and sanitized logs. Feature proposals should explain the user problem, scope, risks, and measurable acceptance criteria.

## Security reports

Please do not publish exploitable vulnerabilities, credentials, private user data, or sensitive attack details in a public issue. Follow the private reporting options available through the repository's GitHub Security tab. If private reporting is not enabled, contact the repository owner privately before sharing sensitive details.

## Scope and conduct

Be respectful, assume good intent, explain technical disagreements with evidence, and keep reviews focused on the work. Contributions may be revised or declined when they conflict with the project’s safety, security, licensing, or roadmap constraints.

## License

No license file is currently present. Do not assume that repository visibility grants permission to reuse or redistribute the code. Licensing must be established by the project owner.
