---
type: Architecture Decision Record
title: "ADR-0001 — MessageEvent is a closed discriminated union"
description: Why the core inbound event union stays closed, trading Open/Closed purity for compile-time exhaustive narrowing.
tags: [adr, accepted, core, types, ocp]
decision_status: Accepted
decision_date: 2026-07-10
deciders: gateway cluster maintainers
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: adr-src
    resource: "git:c891696:docs/adr/0001-message-event-closed-union.md"
    title: ADR-0001, original file under docs/adr (removed 2026-08-06, absorbed here)
    author: human:gateway-maintainers
    last_modified: 2026-07-10
  - id: union-code
    resource: packages/gateway/src/types/message-event.ts
    title: "MessageEvent source, @theokit/gateway"
  - id: arch-report
    resource: "architect-output/ARCHITECTURE-REPORT.md (coupling#4 / pattern#9) — untracked audit output"
    title: Automated architecture audit that raised the question
---

**Status: Accepted** · decided 2026-07-10 by the gateway cluster maintainers.

# Context and problem

[`@theokit/gateway`](/packages/theokit-gateway.md) defines
[`MessageEvent`](/core-api/message-event.md) as a **closed** discriminated union:
all ten platform event interfaces (`TelegramMessageEvent`, `DiscordMessageEvent`,
…) are declared in core and folded into one union keyed by `platform`.[^union-code]

Core is the most-depended-on module in the cluster — afferent coupling
$C_a = 10$, instability $I \approx 0.09$ — so it therefore carries structural
knowledge of every platform. Adding an eleventh gateway means **editing the
stable core union** rather than extending it purely additively, which is in
tension with the Open/Closed Principle.[^arch-report]

The question raised by the audit: should the union be opened — for example a
generic `MessageEvent<TPlatform, TExtra>` that new platforms extend without
touching core?

# Decision

**Keep the union closed. Do not open it for OCP purity.**

The whole consumer ergonomics of the gateway rest on **exhaustive narrowing**:

```typescript
switch (event.platform) {
  case "telegram": return event.telegram.threadId; // narrowed
  case "discord":  return event.discord.guildId;   // narrowed
  // a missing case is a compile error via the `never` exhaustiveness check
}
```

`session/router.ts` (`defaultStrategy`) and every consumer `switch` rely on the
compiler proving all platforms are handled. Opening the union would trade
**compile-time exhaustiveness** for **runtime uncertainty** — the exact property
a curated, first-party set of adapters should not give up.[^adr-src]

# Consequences

- **Positive.** Consumers get exhaustive, compiler-checked narrowing. A new
  platform cannot be half-wired: the `never` check fails the build until every
  `switch` handles it.
- **Negative (accepted).** Adding a gateway is a bounded, compiler-guarded
  ~3-line edit to the core union — add the `PlatformName` literal, add the
  variant interface, fold it into the union. That is a *modification*, not a
  pure *extension*.

# Revisit trigger

If third-party or out-of-repo adapters ever become a supported goal, reopen this
decision — today all eleven packages, from
[`@theokit/gateway`](/packages/theokit-gateway.md) out to
[`gateway-matrix`](/packages/gateway-matrix.md), are first-party and in-repo. An
open or generic union would then be worth its runtime-uncertainty cost. Until
then, closed wins.

# Alternatives considered

1. **Generic open union (`MessageEvent<P, X>`)** — rejected: defeats exhaustive
   narrowing; every consumer would need runtime platform guards.
2. **Registry of event shapes resolved at runtime** — rejected: moves a
   compile-time guarantee to runtime for no first-party benefit (YAGNI).

# Related

- The type this decision governs: [`MessageEvent`](/core-api/message-event.md).
- Its sibling naming decision, which points at this one for where the canonical
  inbound shape lives: [ADR-0002](/decisions/adr-0002-type-file-naming-convention.md).
- The effort that produced both ADRs (milestone M3):
  [architecture hardening](/initiatives/architecture-hardening.md).

[^adr-src]: ADR-0001, original file under `docs/adr`
[^union-code]: `MessageEvent` source, `@theokit/gateway`
[^arch-report]: Automated architecture audit (coupling#4 / pattern#9)
