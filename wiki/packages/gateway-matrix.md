---
type: npm Package
title: "@theokit/gateway-matrix"
description: Matrix protocol adapter on matrix-js-sdk — member-count-driven DM detection, and a ConfigurationError on the core base.
resource: https://www.npmjs.com/package/@theokit/gateway-matrix
tags: [package, adapter, matrix, federation]
package_version: 0.1.1
platform: matrix
sdk: matrix-js-sdk
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-matrix/package.json
    title: Package manifest at c891696
  - id: errors
    resource: packages/gateway-matrix/src/errors.ts
    title: ConfigurationError extending the core base
---

The Matrix adapter, built on **matrix-js-sdk**.[^manifest] `MatrixMessageEvent`
— see [`MessageEvent`](/core-api/message-event.md) — carries `roomId`
(`!xxx:server`), `eventId` (`$xxx:server`), and `memberCount`.

`memberCount` is there for a specific reason: Matrix has no DM flag. A room is
treated as a direct message by **counting joined members**, which is how the
adapter fills `channel.type` in the base event. That is a normalization decision
the raw protocol does not make for you.

# Source layout

```
packages/gateway-matrix/src/
  adapter.ts     the BasePlatformAdapter implementation
  alias.ts       room-alias resolution
  client.ts      matrix-js-sdk client wiring
  errors.ts      ConfigurationError extends GatewayConfigurationError
  normalize.ts   MatrixEvent -> MatrixMessageEvent
  room-state.ts  room state tracking
  sync.ts        the sync loop
  types.ts       public shapes and options
  index.ts       barrel
```

`types.ts` and no `backend-types.ts` — single-backend with public shapes, per
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md).

# Splitting

No `split.ts`. Matrix imposes no message-length cap the adapter needs to work
around, so it uses neither [`chunkText`](/core-api/chunk-text.md) nor
[`chunkByGrapheme`](/core-api/chunk-by-grapheme.md) — it was never part of the
duplicated-splitter problem milestone M1 solved.

# Errors

One of the **four** adapters extending
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md), repointed
in milestone M2 of the
[architecture-hardening effort](/initiatives/architecture-hardening.md) after a
backfilled `errors.test.ts` pin landed in M0.[^errors]

[^manifest]: Package manifest at `c891696`
[^errors]: `packages/gateway-matrix/src/errors.ts`
