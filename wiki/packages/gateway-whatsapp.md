---
type: npm Package
title: "@theokit/gateway-whatsapp"
description: WhatsApp adapter with a two-backend seam — Meta Cloud API and a whatsapp-web.js bridge behind one interface.
resource: https://www.npmjs.com/package/@theokit/gateway-whatsapp
tags: [package, adapter, whatsapp, multi-backend]
package_version: 0.1.1
platform: whatsapp
backends: [cloud, web]
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-whatsapp/package.json
    title: Package manifest at c891696
  - id: split
    resource: packages/gateway-whatsapp/src/split.ts
    title: Thin wrapper over core chunkText
---

The WhatsApp adapter. It is **multi-backend**: the Meta Cloud API and a
`whatsapp-web.js` bridge, both behind one internal seam.[^manifest]

`WhatsAppMessageEvent` — see [`MessageEvent`](/core-api/message-event.md) —
carries the backend discriminator explicitly (`backend: "cloud" | "web"`),
because the two produce different ids and different metadata: `wamid` is
`wamid.xxx` under Cloud and `msg.id._serialized` under Web, and `phoneNumberId`
(Meta-issued) exists only under Cloud.

# Source layout

```
packages/gateway-whatsapp/src/
  adapter.ts          the BasePlatformAdapter implementation
  backend/            per-backend implementations
  backend-types.ts    the WhatsAppBackend seam interface
  bridge/             whatsapp-web.js bridge
  errors.ts           send-error mapping
  split.ts            thin wrapper over core chunkText
  index.ts            barrel
```

This package is the canonical example in
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md): it has
`backend-types.ts` but **no** plain `types.ts`, which is exactly what the
convention predicts for an adapter with a backend seam and no public shapes
beyond the event. The mismatch it created before the convention was written down
is what motivated the ADR.

# Splitting

Slack family, with part trimming:[^split]

```typescript
chunkText(text, {
  limit: 4096,                    // WHATSAPP_MAX_TEXT
  boundaries: ["\n\n", "\n", " "],
  lastResort: "last-boundary",
  surrogateGuard: true,
  stripLeading: /^\s+/,
  trimParts: true,
});
```

Migrated to [`chunkText`](/core-api/chunk-text.md) in milestone M1 of the
[architecture-hardening effort](/initiatives/architecture-hardening.md),
golden-pinned byte-identical.

# Errors

`errors.ts` maps Meta error codes (Cloud follows the Graph API error-handling
contract) and is **not** a
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md)
subclass — one of the four packages the audit had miscounted.

[^manifest]: Package manifest at `c891696`
[^split]: `packages/gateway-whatsapp/src/split.ts`
