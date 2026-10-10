# Repository governance

This document proposes a compact, consistent label system for SAMURA issues and pull requests. Use labels to help triage work; never use them to imply that a capability or security review has passed.

## Label taxonomy

Use lowercase names and stable prefixes. Create only labels that will actually be used.

| Category | Labels | Suggested color |
|---|---|---|
| Type | `type: bug`, `type: feature`, `type: enhancement`, `type: documentation`, `type: security`, `type: research`, `type: maintenance` | Type-specific muted colors |
| Priority | `priority: critical`, `priority: high`, `priority: medium`, `priority: low` | Critical/high use warm red/orange; medium gold; low neutral |
| Workflow | `status: triage`, `status: ready`, `status: in progress`, `status: blocked`, `status: needs review` | Gray, blue, purple, red, teal |
| Area | `area: frontend`, `area: backend`, `area: ai`, `area: database`, `area: security`, `area: infrastructure`, `area: documentation` | Consistent cool palette |
| Contribution | `good first issue`, `help wanted` | GitHub-standard contribution colors |

## Triage rules

1. Every new issue should receive one type label and a workflow status after triage.
2. Add an area label when the work has a clear primary owner or subsystem.
3. Set priority only after considering impact, urgency, and scope; reserve critical for active, high-impact incidents.
4. Mark work as ready only when scope and acceptance criteria are clear.
5. Use blocked when a decision, credential, external service, or prerequisite prevents progress.
6. Add good first issue only when the task is genuinely bounded and has enough context for a new contributor.
7. Do not label a feature verified or production-ready without recorded evidence.

## Current setup note

The issue forms intentionally do not auto-apply custom labels until the label set has been confirmed in repository settings. The available GitHub connector in this session does not expose a label-creation operation, so these labels are proposed here rather than falsely reported as created. Create or reconcile them under **Repository → Issues → Labels** before applying them to issue forms or existing issues.

No issues have been invented or reassigned as part of this documentation work.
