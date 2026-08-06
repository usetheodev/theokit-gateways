---
type: npm Package
title: "@theokit/gateway-line"
description: LINE Messaging API adapter — grapheme-family splitter, one-shot reply tokens, and a ConfigurationError on the core base.
resource: https://www.npmjs.com/package/@theokit/gateway-line
tags: [package, adapter, line, grapheme]
package_version: 0.1.1
platform: line
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-line/package.json
    title: Package manifest at c891696
  - id: split
    resource: packages/gateway-line/src/split.ts
    title: Thin wrapper over core chunkByGrapheme
  - id: errors
    resource: packages/gateway-line/src/errors.ts
    title: ConfigurationError extending the core base
---

The LINE Messaging API adapter.[^manifest] It emits `LineMessageEvent` — see
[`MessageEvent`](/core-api/message-event.md) — carrying `sourceType`
(`"user" | "group" | "room"`), `sourceId`, `messageId`, the `mentionees` user-id
list (never inlined into the text), and `replyToken`.

The reply token is the platform quirk worth knowing: it is **one-shot with a 60-second
TTL**, so the adapter manages it in a `reply-cache.ts` and callers are not meant
to use it directly.

# Source layout

```
packages/gateway-line/src/
  adapter.ts          the BasePlatformAdapter implementation
  client.ts           LINE API client
  errors.ts           ConfigurationError extends GatewayConfigurationError
  normalize.ts        webhook event -> LineMessageEvent
  reply-cache.ts      one-shot reply-token store
  signature.ts        webhook signature verification
  split.ts            thin wrapper over core chunkByGrapheme
  types.ts            public shapes and options
  webhook-server.ts   inbound HTTP surface
  index.ts            barrel
```

# Splitting — grapheme family

LINE is one of the two adapters in the **grapheme family**, which
[`chunkText`](/core-api/chunk-text.md) deliberately does not cover:[^split]

```typescript
splitForLine(text, limit = 5000) // -> chunkByGrapheme(text, { limit })
```

That is the whole wrapper. Unlike [gateway-sms](/packages/gateway-sms.md), LINE
reserves nothing for a part prefix, so it passes `limit` alone and lets
`partLimit` default. See [`chunkByGrapheme`](/core-api/chunk-by-grapheme.md).

# Errors

One of the **four** adapters that actually extend
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md), hoisted
in milestone M2 of the
[architecture-hardening effort](/initiatives/architecture-hardening.md). It
re-exports `ConfigurationErrorOptions` as an alias of the core options type and
pins the prefix `"gateway-line"`.[^errors]

This package also received a backfilled `errors.test.ts` pin during M0, before
the class was repointed at the base.

[^manifest]: Package manifest at `c891696`
[^split]: `packages/gateway-line/src/split.ts`
[^errors]: `packages/gateway-line/src/errors.ts`
