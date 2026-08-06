---
type: Architecture Decision Record
title: "ADR-0002 — Per-package type-file naming convention"
description: What belongs in a package's types.ts versus its backend-types.ts, so a filename predicts its contents.
tags: [adr, accepted, convention, naming, packages]
decision_status: Accepted
decision_date: 2026-07-10
deciders: gateway cluster maintainers
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: adr-src
    resource: "git:c891696:docs/adr/0002-type-file-naming-convention.md"
    title: ADR-0002, original file under docs/adr (removed 2026-08-06, absorbed here)
    author: human:gateway-maintainers
    last_modified: 2026-07-10
  - id: tree
    resource: "packages/gateway-*/src/ — file listing at c891696"
    title: Actual adapter source layout, which the convention describes
---

**Status: Accepted** · decided 2026-07-10 by the gateway cluster maintainers.

# Context and problem

The adapter packages named their type modules unevenly: some had `types.ts`,
some `backend-types.ts`, some both, some neither.
[`gateway-whatsapp`](/packages/gateway-whatsapp.md) has `backend-types.ts` but no
plain `types.ts`; [`gateway-sms`](/packages/gateway-sms.md) has both. The
distinction is meaningful but was never written down, so a reader could not
predict which file holds what.[^adr-src]

# Decision

Adopt the convention below. It is **documentation-only** — no file renames, since
churn is not worth it for a low-severity nit.

`types.ts`
: The package's **public inbound/outbound shapes** and options interfaces — what
  a consumer of the adapter sees.

`backend-types.ts`
: The **internal backend seam** contract: the interface a multi-backend adapter
  implements per provider. Examples are the `WhatsAppBackend` interface with its
  Cloud and Web implementations, and the SMS provider seam. Present only in
  packages that actually have a backend seam.

A package may have **either, both, or neither**, depending on whether it is
single-backend and whether it exposes public shapes beyond
[`MessageEvent`](/core-api/message-event.md).

# How the tree reads under the convention

| Package | `types.ts` | `backend-types.ts` | Why |
|---|---|---|---|
| [gateway-sms](/packages/gateway-sms.md) | yes | yes | Public shapes **and** a three-provider seam (Twilio / Plivo / Vonage) |
| [gateway-whatsapp](/packages/gateway-whatsapp.md) | no | yes | Two-backend seam (Cloud / Web); no public shapes beyond the event |
| [gateway-email](/packages/gateway-email.md) | yes | no | Public shapes; single backend |
| [gateway-line](/packages/gateway-line.md) | yes | no | Public shapes; single backend |
| [gateway-matrix](/packages/gateway-matrix.md) | yes | no | Public shapes; single backend |
| [gateway-mattermost](/packages/gateway-mattermost.md) | yes | no | Public shapes; single backend |
| [gateway-teams](/packages/gateway-teams.md) | yes | no | Public shapes; single backend |
| [gateway-slack](/packages/gateway-slack.md) | no | no | Neither — nothing public beyond the event, single backend |
| [gateway-discord](/packages/gateway-discord.md) | no | no | Neither |
| [gateway-telegram](/packages/gateway-telegram.md) | no | no | Neither |

The table is the tree as it actually stood when the convention was recorded.[^tree]

# Consequences

- **Positive.** The filename predicts contents; new contributors know where to
  look and where to add a type.
- **Negative (accepted).** Existing files are not renamed, so the convention is
  enforced going forward by review, not retroactively. A future package that
  violates it should be corrected in the PR that introduces it.

# Related

- [ADR-0001](/decisions/adr-0001-message-event-closed-union.md) — the canonical
  inbound shape lives in core `types/message-event.ts`, **not** in a per-package
  `types.ts`. That is the boundary this convention assumes.
- The effort that produced both ADRs (milestone M3):
  [architecture hardening](/initiatives/architecture-hardening.md).

[^adr-src]: ADR-0002, original file under `docs/adr`
[^tree]: Adapter source layout at commit `c891696`
