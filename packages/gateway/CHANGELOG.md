# Changelog

## 0.4.1

### Patch Changes

- e926cd9: Align the gateway cluster to the hardened `@theokit/sdk` 2.18.0 Harness (ecosystem M6). Bumped the `@theokit/sdk` peer + dev dependency from `^1.9.0` to `^2.18.0` across all 11 packages. The only consumed SDK surface is `Security.redact` (in the gateway core runner) — a stable public API (ADR D68) unchanged across 1.x→2.x — so the alignment is a pin bump, not a migration. Validated: all 11 packages typecheck + build + test green against 2.18.0 (543 tests passed). No dead/unwired surfaces (`no-stubs-no-mocks-no-wired` checklist clean).

## [Unreleased]

### Added

- `chunkText(text, options)` — transport-agnostic, boundary-preferring text chunker exported from the public barrel. Single-sources the message-splitting knowledge duplicated across the platform adapters; faithfully reproduces the Slack-family (fixed window, space boundary, surrogate guard) and Telegram-family (soft window, newline-only) algorithms via options (roadmap M0, arch-hardening).
- `chunkByGrapheme(text, options)` — grapheme-cluster-safe (`Intl.Segmenter`) chunker exported from the public barrel. Single-sources the grapheme walk shared by the LINE and SMS adapters; never severs an emoji, regional-indicator pair, or combining sequence (roadmap M1, arch-hardening).
- `GatewayConfigurationError` base + `GatewayConfigurationErrorOptions` — shared base for per-adapter `ConfigurationError` classes, exported from the public barrel (roadmap M0, arch-hardening).

### Changed

- Moved the `HookExecutor` run engine from `hooks/types.ts` into `hooks/executor.ts` so the filename predicts its contents; `hooks/types.ts` now holds the hook contract (interfaces + `HookName`) only. Public API is byte-identical — `HookExecutor` and all hook interfaces are re-exported unchanged from the barrel (roadmap M0, arch-hardening).
- **Documentation only:** added `src/README.md` documenting the 6 single-file sub-folder cluster (`adapter/`, `delivery/`, `hooks/`, `runner/`, `session/`, `types/`) as intentional bounded future-extensibility scaffold (T10.2 of plan `arch-review-fixes-2026-06-06`; FO#4 of 2026-06-06 architecture audit). Rationale + ADR cross-references (D170-D177) + 12-month re-evaluation trigger documented. No code change.

## 2.0.0

### Patch Changes

- Updated dependencies
  - @theokit/sdk@1.3.0

## 1.0.0

### Patch Changes

- Updated dependencies
  - @theokit/sdk@1.2.0

## [Unreleased]

### Added — Tier 1 Expansion variants (T0.1, ADRs D389/D397/D405/D413)

- `SMSMessageEvent` variant added to the `MessageEvent` discriminated union. Required for `@theokit/gateway-sms`.
- `MattermostMessageEvent` variant added to the `MessageEvent` discriminated union. Required for `@theokit/gateway-mattermost`.
- `LineMessageEvent` variant added to the `MessageEvent` discriminated union. Required for `@theokit/gateway-line`.
- `MatrixMessageEvent` variant added to the `MessageEvent` discriminated union. Required for `@theokit/gateway-matrix`.
- `PlatformName` union opened to include `"sms" | "mattermost" | "line" | "matrix"` (10 platforms total).

### Changed

- Backward-compatible additive change — existing adapters / consumers continue to compile. The single `exhaustive switch` test was updated to cover the new 4 cases (EC-5 absorbed).

## [0.4.0] - 2026-05-24

### Added

- `EmailMessageEvent` variant added to the `MessageEvent` discriminated union (ADR D339). Required for `@theokit/gateway-email`.
- `PlatformName` union opened to include `"email"`.

### Changed

- Minor version bump (additive change — existing adapters / consumers unaffected).

## [0.3.0] - 2026-05-23

### Added

- `TeamsMessageEvent` variant added to the `MessageEvent` discriminated union (ADR D325). Required for `@theokit/gateway-teams`.
- `PlatformName` union opened to include `"teams"`.

### Changed

- Minor version bump (additive change — existing adapters / consumers unaffected).

## [0.2.0] - 2026-05-23

### Added

- `WhatsAppMessageEvent` variant added to the `MessageEvent` discriminated union (ADR D308). Required for `@theokit/gateway-whatsapp`.
- `PlatformName` union opened to include `"whatsapp"`.

### Changed

- Minor version bump (additive change — existing adapters / consumers unaffected).

## [0.1.0] — 2026-05-20

### Added

- Initial release. Core gateway primitives for `@theokit/sdk`.
- `BasePlatformAdapter` abstract class — contract for transport adapters (ADR D172).
- `MessageEvent` discriminated union with `platform` discriminator (ADR D173).
- `GatewayRunner` — top-level orchestrator with drain timeout on `stop()` (EC-E).
- `SessionRouter` — pure routing strategy; composes `Agent.resume` (ADR D174).
- `DeliveryRouter` — outbound dispatch; composes `Cron` (ADR D175).
- `HookExecutor` with `pre_inbound` / `post_outbound` / `on_error` (ADRs D176, D177).
- `ctx.reply` auto-routes to the adapter matching `event.platform` (EC-G).
- `{ block: true, message }` from `pre_inbound` triggers auto-reply before short-circuit (EC-D).
- All runner error log paths wrap text in `Security.redact(...)` from `@theokit/sdk` (EC-F, ADR D68).
