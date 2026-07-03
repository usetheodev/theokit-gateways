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

### Added — `@theokit/gateway-mattermost@0.1.0` (ADRs D397-D404)

- Initial release of the Mattermost platform adapter for `@theokit/gateway`.
- `@mattermost/client@^9.0.0` peer-dep (modern v4 REST + WebSocket gateway).
- `MattermostAdapter` extending `BasePlatformAdapter`:
  - `connect()` initializes Client4 + WebSocketClient; caches bot userId via `getMe()`.
  - `disconnect()` closes WebSocket; idempotent.
  - `sendMessage()` posts to channel; thread replies set `root_id` from `topicId`.
  - `onInbound()` subscribes to WS `posted` events; single-handler replace semantics (EC-H).
- Inbound dispatch pipeline (D403, EC-2):
  1. Drop bot's own posts (loop guard, D275 mirror).
  2. DMs always dispatch.
  3. Channels: respond only when mentioned. **Metadata.mentions array checked FIRST** (unambiguous user-id list from API) before falling back to text-regex with **word-boundary** (`\b@${botUsername}\b` — prevents `@theory` matching `@theo`).
- Channel-type mapping (D402): `D` → `dm`, `G`/`O`/`P` → `group`. Original Mattermost type preserved in `event.mattermost.channelType`.
- Personal Access Token auth (D401). OAuth deferred to v0.2.
- File uploads (D404), Slash commands, and ephemeral messages deferred to v0.2 — caller can access `adapter.getClient()` (REST) for escape-hatch use.
