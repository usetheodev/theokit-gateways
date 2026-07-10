# ADR-0002 — Per-package type-file naming convention

- Status: Accepted
- Date: 2026-07-10
- Deciders: gateway cluster maintainers
- Context source: `architect-output/ARCHITECTURE-REPORT.md` (naming#3), roadmap M3

## Context and Problem Statement

The adapter packages name their type modules unevenly: some have `types.ts`,
some `backend-types.ts`, some both, some neither (e.g. `gateway-whatsapp` has
`backend-types.ts` but no plain `types.ts`; `gateway-sms` has both). The
distinction is meaningful but was never written down, so a reader cannot
predict which file holds what.

## Decision

Adopt this convention (documentation-only; no file renames — churn is not worth
it for a low-severity nit):

- **`types.ts`** — the package's **public inbound/outbound shapes** and options
  interfaces (what a consumer of the adapter sees).
- **`backend-types.ts`** — the **internal backend seam** contract: the interface
  a multi-backend adapter implements per provider (e.g. the `WhatsAppBackend`
  interface with Cloud/Web implementations, or the SMS provider seam). Present
  only in packages that actually have a backend seam.
- A package may have **either, both, or neither** depending on whether it is
  single-backend and whether it exposes public shapes beyond `MessageEvent`.

## Consequences

- **Positive:** the filename predicts contents; new contributors know where to
  look and where to add a type.
- **Negative (accepted):** existing files are not renamed, so the convention is
  enforced going forward by review, not retroactively. A future package that
  violates it should be corrected in the PR that introduces it.

## Related

- ADR-0001 (closed `MessageEvent` union) — the canonical inbound shape lives in
  core `types/message-event.ts`, not in per-package `types.ts`.
