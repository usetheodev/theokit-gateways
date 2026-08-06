---
okf_version: "0.2"
---

# theokit-gateways wiki

Institutional knowledge for the `theokit-gateways` monorepo: eleven packages —
one transport-agnostic core and ten platform adapters — and the decisions,
reviews and releases that shaped them.

This bundle is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
v0.2 bundle. Every file is a concept with a `type`; navigate by descending only
the branches a question needs.

**Start here if you want to know…**

- *why the core union is closed* → [ADR-0001](decisions/adr-0001-message-event-closed-union.md)
- *what an adapter emits* → [MessageEvent](core-api/message-event.md)
- *how a platform's message-length cap is handled* → [chunkText](core-api/chunk-text.md)
- *why adapters were not republished with core 0.5.0* → [release model](releases/release-model.md)
- *what the July 2026 refactor actually changed* → [architecture hardening](initiatives/architecture-hardening.md)

# Initiatives

* [Architecture hardening (M0–M3)](initiatives/architecture-hardening.md) - July 2026. Extracted the shared chunking and error primitives; recorded two decisions; three exclusions documented as decisions.

# Decisions

* [ADR-0001 — MessageEvent is a closed discriminated union](decisions/adr-0001-message-event-closed-union.md) - Accepted. Exhaustive narrowing beats Open/Closed purity for a first-party adapter set.
* [ADR-0002 — Per-package type-file naming convention](decisions/adr-0002-type-file-naming-convention.md) - Accepted. What belongs in `types.ts` versus `backend-types.ts`.

# Core API

* [MessageEvent](core-api/message-event.md) - The canonical inbound event, a closed union keyed by `platform`.
* [chunkText](core-api/chunk-text.md) - Boundary-preferring chunker for the Slack and Telegram families.
* [chunkByGrapheme](core-api/chunk-by-grapheme.md) - `Intl.Segmenter` grapheme-safe chunker for LINE and SMS.
* [GatewayConfigurationError](core-api/gateway-configuration-error.md) - Shared base for per-adapter configuration errors.
* [HookExecutor](core-api/hook-executor.md) - Runs hooks at `pre_inbound`, `post_outbound` and `on_error`.

# Packages

* [@theokit/gateway](packages/theokit-gateway.md) - v0.5.0, the transport-agnostic core.
* [@theokit/gateway-telegram](packages/gateway-telegram.md) - grammy. Keeps a local markdown-balancing splitter.
* [@theokit/gateway-discord](packages/gateway-discord.md) - discord.js. Telegram-family splitting, 2000 / 1900.
* [@theokit/gateway-slack](packages/gateway-slack.md) - `@slack/bolt`. The Slack chunking family's namesake.
* [@theokit/gateway-whatsapp](packages/gateway-whatsapp.md) - Meta Cloud API + whatsapp-web.js bridge.
* [@theokit/gateway-teams](packages/gateway-teams.md) - `@microsoft/teams.apps` v2. The 8000-char window.
* [@theokit/gateway-email](packages/gateway-email.md) - nodemailer + imapflow + mailparser. Header-driven threading.
* [@theokit/gateway-sms](packages/gateway-sms.md) - Twilio / Plivo / Vonage, with `(i/N) ` part prefixes.
* [@theokit/gateway-line](packages/gateway-line.md) - LINE Messaging API. One-shot 60 s reply tokens.
* [@theokit/gateway-matrix](packages/gateway-matrix.md) - matrix-js-sdk. DM detection by joined-member count.
* [@theokit/gateway-mattermost](packages/gateway-mattermost.md) - WebSocket gateway + REST.

# Reviews

* [Architecture hardening (M0–M3)](reviews/architecture-hardening-2026-07-10.md) - 2026-07-10, READY_TO_MERGE. Two defects found and fixed; two honesty corrections against the audit.

# Releases

* [Release model](releases/release-model.md) - Repo tag versus npm publish, and the peer-dependency cascade.
* [v1.9.0](releases/v1-9-0.md) - 2026-07-10, RELEASED. Repo tag; no npm publish.
* [@theokit/gateway@0.5.0](releases/theokit-gateway-0-5-0-npm.md) - 2026-07-10, PUBLISHED. Core-only.

# Reference

* [Glossary](glossary.md) - Recurring terms across the decisions, reviews and release records.
