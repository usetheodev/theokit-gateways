---
type: npm Package
title: "@theokit/gateway-slack"
description: Slack adapter built on @slack/bolt — the reference implementation of the Slack chunking family.
resource: https://www.npmjs.com/package/@theokit/gateway-slack
tags: [package, adapter, slack, bolt]
package_version: 0.1.1
platform: slack
sdk: "@slack/bolt"
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-slack/package.json
    title: Package manifest at c891696
  - id: split
    resource: packages/gateway-slack/src/split.ts
    title: Thin wrapper over core chunkText
---

The Slack adapter, built on **`@slack/bolt`**.[^manifest] It emits
`SlackMessageEvent` — see [`MessageEvent`](/core-api/message-event.md) — whose
extras are the ones a Slack integration actually needs: `teamId` (which may be
`undefined` on some legacy events), `channelId`, `userId` (falling back to
`"anonymous"`), `ts` as the canonical message id, plus `threadTs` and `subtype`
when the message is threaded or special.

# Source layout

```
packages/gateway-slack/src/
  adapter.ts    the BasePlatformAdapter implementation
  errors.ts     send-error mapping (not a ConfigurationError subclass)
  normalize.ts  Bolt event -> SlackMessageEvent
  split.ts      thin wrapper over core chunkText
  index.ts      barrel
```

# Splitting — the family's namesake

Slack is the reference member of the **Slack family** that
[`chunkText`](/core-api/chunk-text.md) reproduces: fixed window, space allowed
as a last boundary, surrogate guard on, whitespace strip on continuation.[^split]

```typescript
chunkText(text, {
  limit: 4000,                    // SLACK_MAX_TEXT
  boundaries: ["\n\n", "\n", " "],
  lastResort: "last-boundary",
  surrogateGuard: true,
  stripLeading: /^\s+/,
});
```

It does **not** set `trimParts`, which is the one option separating it from
[gateway-whatsapp](/packages/gateway-whatsapp.md) and
[gateway-teams](/packages/gateway-teams.md).

# Errors

`errors.ts` exists but holds **send-error mapping**, not a configuration-error
class. It is one of the four packages the architecture audit miscounted as
carrying a `ConfigurationError`; the review corrected the count from eight to
four. See
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md).

[^manifest]: Package manifest at `c891696`
[^split]: `packages/gateway-slack/src/split.ts`
