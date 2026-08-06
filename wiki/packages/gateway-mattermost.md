---
type: npm Package
title: "@theokit/gateway-mattermost"
description: Mattermost adapter — WebSocket gateway plus REST, thread roots via rootId, and a ConfigurationError on the core base.
resource: https://www.npmjs.com/package/@theokit/gateway-mattermost
tags: [package, adapter, mattermost, websocket]
package_version: 0.1.1
platform: mattermost
sdk: "@mattermost/client"
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-mattermost/package.json
    title: Package manifest at c891696
  - id: errors
    resource: packages/gateway-mattermost/src/errors.ts
    title: ConfigurationError extending the core base
---

The Mattermost adapter. Inbound arrives over a **WebSocket gateway**; outbound
goes over **REST**.[^manifest] `MattermostMessageEvent` — see
[`MessageEvent`](/core-api/message-event.md) — carries `postId`, `channelId`,
`teamId`, an optional `rootId`, and `channelType`.

Two normalization details are worth reading off the type. `rootId` is set only
when the message is a **thread reply**, and it names the post the thread is
rooted at. `channelType` preserves Mattermost's **original** single-letter
classification — `"D"` direct, `"G"` group, `"O"` open, `"P"` private — *before*
the adapter maps it onto the base event's
`"dm" | "group" | "thread"`, so a consumer that needs the platform's own notion
still has it.

# Source layout

```
packages/gateway-mattermost/src/
  adapter.ts    the BasePlatformAdapter implementation
  client.ts     @mattermost/client wiring
  errors.ts     ConfigurationError extends GatewayConfigurationError
  filters.ts    inbound filtering
  normalize.ts  Post -> MattermostMessageEvent
  types.ts      public shapes and options
  index.ts      barrel
```

`types.ts` and no `backend-types.ts`, per
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md).

# Splitting

No `split.ts` — outside the scope of the milestone-M1 chunking consolidation.

# Errors

One of the **four** adapters extending
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md) after
milestone M2 of the
[architecture-hardening effort](/initiatives/architecture-hardening.md), with an
`errors.test.ts` pin backfilled in M0 first.[^errors]

[^manifest]: Package manifest at `c891696`
[^errors]: `packages/gateway-mattermost/src/errors.ts`
