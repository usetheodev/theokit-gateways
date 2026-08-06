---
type: npm Package
title: "@theokit/gateway-telegram"
description: Telegram adapter built on grammy — the one adapter whose splitter stayed adapter-local, because markdown-pair balancing is distinct knowledge.
resource: https://www.npmjs.com/package/@theokit/gateway-telegram
tags: [package, adapter, telegram, grammy]
package_version: 0.1.1
platform: telegram
sdk: grammy
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-telegram/package.json
    title: Package manifest at c891696
  - id: split
    resource: packages/gateway-telegram/src/split.ts
    title: The adapter-local splitter
---

The Telegram adapter, built on **grammy**.[^manifest] It emits
`TelegramMessageEvent`, the variant of
[`MessageEvent`](/core-api/message-event.md) carrying `chatId`, `messageId`, an
optional `threadId`, and the raw grammy `Context`.

# Source layout

```
packages/gateway-telegram/src/
  adapter.ts          the BasePlatformAdapter implementation
  group-policy.ts     group/mention handling policy
  split.ts            markdown-aware splitter — NOT a core wrapper
  index.ts            barrel
```

No `types.ts` and no `backend-types.ts`, which under
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md) is the correct
shape for a single-backend adapter exposing nothing public beyond the event.

# Why its splitter did not migrate

Telegram is the deliberate exception in milestone M1 of the
[architecture-hardening effort](/initiatives/architecture-hardening.md). Six
adapters moved to the core primitives; this one kept `split.ts` local, because
it does something the others do not: **balance markdown pairs** at the cut.[^split]

| Constant | Value |
|---|---|
| `TELEGRAM_MAX_MESSAGE` | 4096 |
| `SAFE_CHUNK` | 4000 |
| Boundary preference | `"\n\n"` then `"\n"`, half-window threshold |
| Continuation strip | `/^\n+/` |

After the cut, `balanceMarkdownPairs` counts the markers `**`, `__`, `~~` and
`` ` ``. Any marker with an **odd** count means the chunk would ship with an
unclosed span, so the chunk is truncated back to just before that marker's last
occurrence and right-trimmed — and the cut position is recomputed from the
shortened chunk so the remainder resumes correctly.

Folding this into [`chunkText`](/core-api/chunk-text.md) would have been
accidental coupling: the roadmap listed it as explicitly out of scope, on the
grounds that merging genuinely distinct knowledge is a DRY anti-pattern, not
DRY. Structurally the algorithm is nevertheless the **Telegram family** —
soft window inside a hard cap, no space boundary, newline strip — which is the
family [`chunkText`](/core-api/chunk-text.md) reproduces for
[gateway-discord](/packages/gateway-discord.md).

# Errors

Does not extend
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md); it has
no `errors.ts` module of its own.

[^manifest]: Package manifest at `c891696`
[^split]: `packages/gateway-telegram/src/split.ts`
