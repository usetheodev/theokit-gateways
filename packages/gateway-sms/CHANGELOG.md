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

### Added — `@theokit/gateway-sms@0.1.0` (ADRs D389-D396)

- Initial release of the SMS platform adapter for `@theokit/gateway`.
- Multi-backend opt-in: Twilio + Plivo + Vonage (D389). Each peer-dep is optional; install only what you use.
- `SMSAdapter` extending `BasePlatformAdapter` with:
  - `connect()` / `disconnect()` lifecycle (idempotent)
  - `sendMessage()` outbound with multipart `(i/N)` segmentation up to 1600 chars per part (D393), Intl.Segmenter surrogate-safe
  - `onInbound()` subscription (single-handler replace semantics — EC-H)
- `createWebhookServer()` Express helper with per-backend routes (`/sms/twilio`, `/sms/plivo`, `/sms/vonage`) and per-backend HMAC signature validation (D392) — rejects with 401 BEFORE handler dispatch.
- Constructor enforces signing secret (EC-1 absorbed): missing `authToken` throws `ConfigurationError` at construction time, never permits unsigned mode.
- `normalizeE164(input, defaultCountry?)` strict phone normalization via `libphonenumber-js` (D391). Accepts mobile + toll-free US numbers (EC-6).
- `splitForSMS(text, limit=1600)` UTF-16 / grapheme-cluster safe segmentation (EC-7).
- Tracks `SMSInbound` → `SMSMessageEvent` normalization with E.164 enforcement.
- No threading model: SMS conversations are flat per phone-pair (D394). `channel.type` always `"dm"`.
- MMS, group SMS, and budget-charge-per-message are deferred to v0.2 (D395, D396).
