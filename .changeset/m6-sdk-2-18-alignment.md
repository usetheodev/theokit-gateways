---
"@theokit/gateway": patch
"@theokit/gateway-telegram": patch
"@theokit/gateway-discord": patch
"@theokit/gateway-slack": patch
"@theokit/gateway-whatsapp": patch
"@theokit/gateway-teams": patch
"@theokit/gateway-email": patch
"@theokit/gateway-sms": patch
"@theokit/gateway-line": patch
"@theokit/gateway-matrix": patch
"@theokit/gateway-mattermost": patch
---

Align the gateway cluster to the hardened `@theokit/sdk` 2.18.0 Harness (ecosystem M6). Bumped the `@theokit/sdk` peer + dev dependency from `^1.9.0` to `^2.18.0` across all 11 packages. The only consumed SDK surface is `Security.redact` (in the gateway core runner) — a stable public API (ADR D68) unchanged across 1.x→2.x — so the alignment is a pin bump, not a migration. Validated: all 11 packages typecheck + build + test green against 2.18.0 (543 tests passed). No dead/unwired surfaces (`no-stubs-no-mocks-no-wired` checklist clean).
