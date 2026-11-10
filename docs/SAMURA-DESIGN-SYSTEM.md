# SAMURA AI Design System
**Status:** Discovery specification — not an implementation approval  
**Target foundation:** `feat/chatgpt-capability-parity`  
**Cost constraint:** $0 recurring design-tool spend  
**Scope:** Main AI workspace, navigation, composer, voice, attachments, agent activity and responsive behaviour

## 1. Product design principles

1. **Function before decoration.** Preserve the existing chat, streaming, conversation, authentication, provider and persistence behaviour.
2. **One coherent workspace.** Chat, research, files, image generation, voice and agent tools should feel like parts of one product, not separate demos.
3. **Progressive disclosure.** Keep the default chat surface calm; reveal advanced controls when requested.
4. **Mobile is a first-class layout.** Design for narrow screens and touch, not simply shrink the desktop sidebar.
5. **Accessible by default.** Keyboard operation, visible focus, semantic labels, contrast, reduced motion and screen-reader status announcements are required.
6. **No paid dependency.** Prefer existing dependencies and permissively licensed components. Confirm the licence of every copied component and asset before adoption.

## 2. Existing visual foundation to preserve

The current global stylesheet defines:
- Background: `#080b12`
- Surface: `#101522`
- Raised surface: `#151c2b`
- Foreground: `#f4f6fb`
- Muted text: `#9aa5ba`
- Border: `rgba(183, 199, 230, .13)`
- Mint accent: `#a8f0d0`
- Strong accent: `#70ddb1`

Current typography is DM Sans for interface text, with Space Grotesk available as a display face. Preserve these tokens initially; do not introduce a second palette before a visual review.

### Token roles

| Token role | Existing value | Usage |
|---|---|---|
| Canvas | `#080b12` | App background |
| Surface | `#101522` | Sidebar, panels |
| Surface raised | `#151c2b` | Popovers, elevated controls |
| Text primary | `#f4f6fb` | Main content |
| Text muted | `#9aa5ba` | Supporting information |
| Border | `rgba(183,199,230,.13)` | Dividers and outlines |
| Accent | `#a8f0d0` | Primary actions and active states |
| Accent strong | `#70ddb1` | Hover/active accent |

Use accent colour sparingly. Do not use it as a large page background or for every icon.

## 3. Main AI workspace information architecture

### Desktop
- **Left navigation rail/sidebar:** SAMURA identity, new chat, conversation search, recent conversations, archived conversations, Studio/tools entry, settings and account actions.
- **Primary conversation canvas:** message history, loading/empty state, user and assistant messages, citations, tool activity, response actions.
- **Composer dock:** multiline input, attachment entry, image/tool entry points where supported, voice input, send/stop control, current mode/model context where already supported.
- **Contextual surfaces:** tool approval, file details, research sources and settings should appear as drawers, dialogs or clearly bounded panels rather than permanently consuming the conversation width.

### Mobile
- Sidebar becomes a dismissible navigation drawer.
- Conversation canvas uses the full viewport width and respects safe-area insets.
- Composer remains reachable above the on-screen keyboard; no fixed-height layout that hides typed text or controls.
- Primary actions use touch targets of at least 44 by 44 CSS pixels.
- Avoid desktop-only hover affordances; expose actions through visible controls or an accessible overflow menu.

## 4. Main screen states to design

The main chat workspace is incomplete if only its ideal state is designed. Specify and test:

1. New/empty conversation.
2. Existing conversation with short and long messages.
3. Streaming response with stop action.
4. Failed or partial response with retry/recovery affordance.
5. Loading conversation history and loading older messages.
6. Code mode and formatted code blocks.
7. Research response with citations and source links.
8. Image generation result and image loading/error states.
9. Voice idle, listening, permission denied, unsupported browser and read-aloud states.
10. File selected, parsing, supported file, unsupported file, oversized file and processing failure states.
11. Tool execution, approval required, rejected, completed and failed states.
12. Empty search, matching search results and archived conversations.

Do not show a control as available unless its underlying feature is implemented and enabled.

## 5. Component strategy and candidate libraries

### Foundation: shadcn/ui
Use as a source pattern and selective component foundation for accessible primitives, dialogs, menus, forms, sidebars and consistent interaction states. It is not a mandate to replace existing custom components wholesale.

Official source: https://ui.shadcn.com/  
Repository: https://github.com/shadcn-ui/ui  
Licence: MIT (verify the exact copied files and any third-party assets at adoption time).

### AI interaction reference: BoardUI
Use for design research around agent activity, execution logs, thinking indicators and AI workspace composition. Inspect individual components before copying; confirm their current source licence and dependencies.

Website: https://www.boardui.com/  
Repository: https://github.com/BoardUI/boardui

### Chat interaction reference: assistant-ui
Evaluate selectively for composer, message presentation, attachment interaction, streaming affordances and accessibility patterns. Do not replace SAMURA's chat runtime, API contract, provider adapter, history model or streaming transport simply to adopt a component library.

Website: https://www.assistant-ui.com/  
Repository: https://github.com/assistant-ui/assistant-ui

### Adoption gate
Before adding any dependency or copying source:
- inspect the exact package version and licence;
- inspect transitive dependencies and bundle impact;
- confirm React 19 / Next.js 16 compatibility;
- check keyboard and screen-reader behaviour;
- compare with existing components to avoid duplication;
- prototype in isolation and run typecheck, lint, tests and production build;
- document attribution and notices where required.

No dependency is approved for installation by this specification.

## 6. Interaction and visual rules

- Use a restrained radius scale: small controls, medium cards, larger composer/panels. Avoid excessive pill-shaped surfaces.
- Establish clear hierarchy through spacing, typography and surface contrast rather than heavy borders.
- Keep message text readable with a comfortable maximum line length.
- Preserve markdown, tables, lists, links and code readability.
- Provide clear focus rings and disabled/loading states.
- Streamed text should not cause disruptive layout shifts.
- Respect reduced-motion preferences.
- Avoid auto-playing audio.
- Use confirmation for destructive conversation actions.
- Never imply that a file, tool call, image or message succeeded before the server confirms it.

## 7. Architecture boundaries

The design work must not:
- change Better Auth or session handling;
- change database schemas, ownership checks, RLS or tenant boundaries;
- alter provider routing, model configuration or server-side secrets;
- change chat API request/response contracts or streaming semantics;
- weaken rate limits, CSP, CSRF protections or upload validation;
- bypass existing analytics privacy scrubbing;
- merge or rewrite the existing capability-parity pull request;
- modify production configuration or deploy to production.

UI components must call existing authenticated APIs and preserve server-side authorization. Treat uploaded files and tool output as untrusted data.

## 8. Proposed implementation sequence

### Phase A — design specification
This document records the visual foundation, information architecture, states, accessibility requirements, component candidates and architecture boundaries.

### Phase B — isolated visual prototype
Build a non-production prototype of the main chat workspace on a separate branch. Use representative fixture data only; do not connect it to production APIs or secrets. Include desktop and mobile layouts plus streaming, empty, error, voice and attachment states.

### Phase C — compatibility review
Compare the prototype against the existing chat implementation and PR #36. Record which components can be reused, adapted or should remain custom. Do not duplicate existing capabilities.

### Phase D — incremental integration
Only after prototype review, integrate approved UI components in small changes. Preserve existing behaviour and run the full verification suite. Keep changes on a reviewable branch and submit a PR; do not merge automatically.

## 9. Acceptance criteria

- [ ] Existing colour and typography foundation is retained unless a reviewed design decision changes it.
- [ ] Desktop and mobile layouts are specified.
- [ ] All states in section 4 have a defined UI treatment.
- [ ] Keyboard navigation and visible focus are supported.
- [ ] Reduced-motion and screen-reader status behaviour are considered.
- [ ] Every adopted component has a verified licence and compatibility check.
- [ ] No duplicate chat runtime or conflicting styling system is introduced.
- [ ] Existing authentication, API, persistence, provider and security boundaries remain intact.
- [ ] No paid service or subscription is required.
- [ ] Prototype is reviewed before production integration.

---
This document is a design specification only. It does not authorise dependency installation, production code changes, secret changes, database changes, deployment or merge.
