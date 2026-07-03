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

- Initial package skeleton (Roadmap v1.4 #3).
- `TeamsAdapter` extending `BasePlatformAdapter` (ADRs D315-D326).
- Built on `@microsoft/teams.apps@^2.0` SDK (D315). Modern Microsoft-published library replacing legacy `botbuilder`.
- `getExpressAdapter()` returns the SDK's `ExpressAdapter` wired into a user-supplied Express app (D316, D326).
- Inbound normalization: 1:1 / group chat / channel post → `TeamsMessageEvent` with portable fields + `event.teams.raw` escape hatch (D318, D320).
- Outbound: `app.send(conversationId, activity)` — string conversation id only (no `ConversationReference` plumbing required by SDK v2).
- Mention stripping via SDK's built-in `mentions.stripText: true` option (D321 + EC-9).
- `splitForTeams` 8000-char message splitter (D322) with UTF-16 surrogate guard.
- `mapTeamsError` HTTP / plain-Error mapper (D300 pattern, EC-7).
- Channel type mapping (D318): `personal → dm`, `groupChat → group`, `channel → group + topicId`.
- Constructor validates non-empty credentials at construction time (EC-1).
- Default arm for unknown `conversationType` — no crash on system activities (EC-3).
- Sender fallback chain: `from.id ?? from.aadObjectId ?? "anonymous"` (EC-4).
- Error mapper tolerates plain `Error` without `.status` (EC-7).
