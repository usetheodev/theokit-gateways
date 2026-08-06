---
type: npm Package
title: "@theokit/gateway-discord"
description: Discord adapter built on discord.js — Telegram-family splitter, migrated to core chunkText in M1.
resource: https://www.npmjs.com/package/@theokit/gateway-discord
tags: [package, adapter, discord, discord.js]
package_version: 0.1.1
platform: discord
sdk: discord.js
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-discord/package.json
    title: Package manifest at c891696
  - id: split
    resource: packages/gateway-discord/src/split.ts
    title: Thin wrapper over core chunkText
---

The Discord adapter, built on **discord.js**.[^manifest] It emits
`DiscordMessageEvent`, carrying `guildId` (`string | null` — `null` in DMs),
`channelId`, `messageId` and the raw discord.js `Message`. See
[`MessageEvent`](/core-api/message-event.md).

# Source layout

```
packages/gateway-discord/src/
  adapter.ts   the BasePlatformAdapter implementation
  split.ts     thin wrapper over core chunkText
  index.ts     barrel
```

Neither `types.ts` nor `backend-types.ts`, which
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md) sanctions for a
single-backend adapter with nothing public beyond the event.

# Splitting

Discord belongs to the **Telegram family**, not the Slack family — a correction
the review made against the original audit, which had assumed a two-family split
where the real shape is three (Slack, Telegram, grapheme). Its `split.ts` is now
a one-call wrapper:[^split]

```typescript
chunkText(text, {
  limit: 2000,        // DISCORD_MAX_MESSAGE
  safeLimit: 1900,    // SAFE_DISCORD_CHUNK
  boundaries: ["\n\n", "\n"],   // no space boundary
  lastResort: "window",
  stripLeading: /^\n+/,
});
```

The soft 1900 window inside the hard 2000 cap is the family signature. Unlike
[gateway-telegram](/packages/gateway-telegram.md), Discord does **not** balance
markdown pairs, which is precisely why it could migrate to
[`chunkText`](/core-api/chunk-text.md) and Telegram could not.

This package also received a backfilled `split.test.ts` pin during milestone M0
of the [architecture-hardening effort](/initiatives/architecture-hardening.md) —
the pin had to exist *before* the conversion, so byte-identity could be proved
rather than asserted.

# Errors

No `errors.ts`; does not extend
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md).

[^manifest]: Package manifest at `c891696`
[^split]: `packages/gateway-discord/src/split.ts`
