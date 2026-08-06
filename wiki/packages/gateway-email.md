---
type: npm Package
title: "@theokit/gateway-email"
description: Email adapter on nodemailer + imapflow + mailparser — RFC threading via Message-ID chains, attachments counted not carried.
resource: https://www.npmjs.com/package/@theokit/gateway-email
tags: [package, adapter, email, imap, smtp]
package_version: 0.1.1
platform: email
sdk: "nodemailer + imapflow + mailparser"
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: manifest
    resource: packages/gateway-email/package.json
    title: Package manifest at c891696
---

The Email adapter, on the community-standard 2026 stack: **nodemailer** for
sending, **imapflow** for fetching, **mailparser** for parsing.[^manifest]

`EmailMessageEvent` — see [`MessageEvent`](/core-api/message-event.md) — is the
richest variant in the cluster, because email threading is header-driven rather
than platform-provided:

| Field | Why it exists |
|---|---|
| `messageId` | The RFC Message-ID **without** `<>` braces. Used as `channel.topicId` for threading. |
| `inReplyTo` | The previous Message-ID this replies to, also unbraced. |
| `references` | The full References chain, oldest to newest. |
| `subject` | Decoded, falling back to `"(no subject)"`. |
| `fromAddress` | Lowercased and normalized. |
| `fromName` | Display name when present. |
| `recipients` | All To/Cc, lowercased, with the **bot's own address excluded** — otherwise every reply would look self-addressed. |
| `attachmentCount` | A **count only**: v0.1 drops attachment payloads by decision. |
| `raw` | The `mailparser.ParsedMail`, as an escape hatch. |

# Source layout

```
packages/gateway-email/src/
  adapter.ts       the BasePlatformAdapter implementation
  errors.ts        send-error mapping
  filters.ts       inbound filtering
  imap-client.ts   imapflow fetch loop
  smtp-client.ts   nodemailer send
  normalize.ts     ParsedMail -> EmailMessageEvent
  seen-uids.ts     dedup across IMAP polls
  thread-store.ts  Message-ID chain tracking
  types.ts         public shapes and options
  index.ts         barrel
```

`seen-uids.ts` and `thread-store.ts` have no counterpart in the other adapters:
IMAP has no delivery-once guarantee and no thread id, so both have to be
reconstructed locally.

`types.ts` without `backend-types.ts` — single-backend with public shapes, per
[ADR-0002](/decisions/adr-0002-type-file-naming-convention.md).

# Splitting

No `split.ts`. Email has no practical message-length cap, so it uses neither
[`chunkText`](/core-api/chunk-text.md) nor
[`chunkByGrapheme`](/core-api/chunk-by-grapheme.md).

# Errors

`errors.ts` holds send-error mapping, **not** a
[`GatewayConfigurationError`](/core-api/gateway-configuration-error.md)
subclass — one of the four packages the architecture audit miscounted before the
review corrected eight to four.

[^manifest]: Package manifest at `c891696`
