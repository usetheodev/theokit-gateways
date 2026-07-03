# Changelog

## 0.1.1

### Patch Changes

- e926cd9: Align the gateway cluster to the hardened `@theokit/sdk` 2.18.0 Harness (ecosystem M6). Bumped the `@theokit/sdk` peer + dev dependency from `^1.9.0` to `^2.18.0` across all 11 packages. The only consumed SDK surface is `Security.redact` (in the gateway core runner) — a stable public API (ADR D68) unchanged across 1.x→2.x — so the alignment is a pin bump, not a migration. Validated: all 11 packages typecheck + build + test green against 2.18.0 (543 tests passed). No dead/unwired surfaces (`no-stubs-no-mocks-no-wired` checklist clean).

## 2.0.0

### Patch Changes

- Updated dependencies
  - @theokit/sdk@1.3.0
  - @theokit/gateway@2.0.0

## 1.0.0

### Patch Changes

- Updated dependencies
  - @theokit/sdk@1.2.0
  - @theokit/gateway@1.0.0

## [Unreleased]

### Added

- `SlackAdapter` implementing `BasePlatformAdapter` (Roadmap #7; ADRs D267-D285).
- Socket Mode transport via `@slack/bolt` (D267, D268).
- `SlackMessageEvent` variant added to gateway `MessageEvent` union (D274).
- `splitForSlack` 4000-char + surrogate-pair guard (D272).
- `mapSlackError` SlackApiError → canonical SendResult codes (D273).
- `requireMention: true` default for channels to prevent cost explosion (D285).
- Bot loop guard via cached `botUserId` (D275, D277).
