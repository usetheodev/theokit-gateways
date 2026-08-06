---
type: npm Package
title: "@theokit/gateway-sms"
description: SMS adapter with a three-provider seam (Twilio, Plivo, Vonage) — the only package with both types.ts and backend-types.ts.
resource: https://www.npmjs.com/package/@theokit/gateway-sms
tags: [package, adapter, sms, multi-backend, grapheme]
package_version: 0.1.1
platform: sms
backends: [twilio, plivo, vonage]
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-sms/package.json
    title: Package manifest at c891696
  - id: split
    resource: packages/gateway-sms/src/split.ts
    title: Wrapper over core chunkByGrapheme with part prefixing
  - id: errors
    resource: packages/gateway-sms/src/errors.ts
    title: ConfigurationError extending the core base
---

The SMS adapter, **multi-backend** across Twilio, Plivo and Vonage.[^manifest]
`SMSMessageEvent` — see [`MessageEvent`](/core-api/message-event.md) — carries
the backend discriminator (`"twilio" | "plivo" | "vonage"`), the provider's own
message id (Twilio `MessageSid`, Plivo `MessageUuid`, Vonage `messageId`), and
`from`/`to` phone numbers normalized to **E.164**.

# Source layout

```
packages/gateway-sms/src/
  adapter.ts          the BasePlatformAdapter implementation
  backend/            per-provider implementations
  backend-types.ts    the provider seam interface
  errors.ts           ConfigurationError extends GatewayConfigurationError
  normalize.ts        webhook payload -> SMSMessageEvent
  phone.ts            E.164 normalization
  split.ts            wrapper over core chunkByGrapheme
  types.ts            public shapes and options
  webhook-server.ts   inbound HTTP surface
  index.ts            barrel
```

It is the **only** package carrying both `types.ts` and `backend-types.ts`, and
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md) uses it as the
"both" case: a provider seam *and* public shapes.

# Splitting — grapheme family with part numbering

The one splitter that post-processes the primitive's output:[^split]

```typescript
const PART_PREFIX_RESERVED = 8; // "(99/99) " worst case

export function splitForSMS(text: string, limit = 1600): string[] {
  const parts = chunkByGrapheme(text, { limit, partLimit: limit - PART_PREFIX_RESERVED });
  if (parts.length <= 1) return parts;       // single part: no prefix
  const total = parts.length;
  return parts.map((p, i) => `(${i + 1}/${total}) ${p}`);
}
```

Reserving eight characters up front is what keeps a prefixed part inside the
1600 cap. See [`chunkByGrapheme`](/core-api/chunk-by-grapheme.md).

**Known edge, recorded not fixed.** At 100 or more parts — a message beyond
roughly 158,000 characters — the prefix grows past the eight reserved
characters and a part can exceed the limit by two. The review classified it as
pre-existing, SMS-specific and byte-identical to the prior behaviour, therefore
out of scope for the hardening effort.

# Errors

One of the four adapters extending
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md), with a
backfilled `errors.test.ts` pin written in M0 before the M2 repoint.[^errors]

[^manifest]: Package manifest at `c891696`
[^split]: `packages/gateway-sms/src/split.ts`
[^errors]: `packages/gateway-sms/src/errors.ts`
