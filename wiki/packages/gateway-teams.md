---
type: npm Package
title: "@theokit/gateway-teams"
description: Microsoft Teams adapter on the @microsoft/teams.apps v2 SDK — the widest chunking window in the cluster at 8000.
resource: https://www.npmjs.com/package/@theokit/gateway-teams
tags: [package, adapter, teams, microsoft]
package_version: 0.1.1
platform: teams
sdk: "@microsoft/teams.apps v2"
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-teams/package.json
    title: Package manifest at c891696
  - id: split
    resource: packages/gateway-teams/src/split.ts
    title: Thin wrapper over core chunkText
---

The Microsoft Teams adapter, built on the **`@microsoft/teams.apps` v2**
SDK.[^manifest] It emits `TeamsMessageEvent` — see
[`MessageEvent`](/core-api/message-event.md) — whose extras reflect the Teams
conversation model: `activityId`, `conversationId`, and a `conversationType`
typed as `"personal" | "groupChat" | "channel" | (string & {})`. That last
member keeps the literal autocomplete while staying open, because the SDK types
the field as an open string. `tenantId` is the sender's Azure AD tenant;
`channelId` and `teamId` appear only when `conversationType === "channel"`.

# Source layout

```
packages/gateway-teams/src/
  adapter.ts    the BasePlatformAdapter implementation
  errors.ts     send-error mapping
  normalize.ts  Teams MessageActivity -> TeamsMessageEvent
  split.ts      thin wrapper over core chunkText
  types.ts      public shapes and options
  index.ts      barrel
```

`types.ts` without `backend-types.ts` — a single-backend adapter that does expose
public shapes, per
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md).

# Splitting

Slack family with part trimming, at the cluster's widest window:[^split]

```typescript
chunkText(text, {
  limit: 8000,                    // TEAMS_MAX_TEXT
  boundaries: ["\n\n", "\n", " "],
  lastResort: "last-boundary",
  surrogateGuard: true,
  stripLeading: /^\s+/,
  trimParts: true,
});
```

Identical option set to [gateway-whatsapp](/packages/gateway-whatsapp.md) apart
from the limit — which is the point of
[`chunkText`](/core-api/chunk-text.md): the difference between two adapters is
now a number, not a hundred lines.

# Errors

`errors.ts` holds send-error mapping, not a
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md)
subclass.

[^manifest]: Package manifest at `c891696`
[^split]: `packages/gateway-teams/src/split.ts`
