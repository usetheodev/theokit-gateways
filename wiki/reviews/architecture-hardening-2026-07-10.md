---
type: Review Record
title: Architecture-hardening review (M0–M3)
description: The READY_TO_MERGE review of the hardening effort — two adversarial lenses, two defects found and fixed, three honesty corrections against the audit.
tags: [review, 2026-07, architecture-hardening, ready-to-merge]
review_date: 2026-07-10
review_verdict: READY_TO_MERGE
slug: architecture-hardening
branch: develop
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: record
    resource: ".claude/knowledge-base/reviews/architecture-hardening-review-2026-07-10.md — untracked, removed 2026-08-06, absorbed here"
    title: Original review record, gitignored and therefore never committed
    last_modified: 2026-07-10
---

**Verdict: READY_TO_MERGE** · 2026-07-10 · branch `develop` · diff
`7ef62a8..HEAD`, 6 commits, roughly +1100 / −270 across 31 files.[^record]

The gate the [v1.9.0 release](/releases/v1-9-0.md) was cut from. Source plan:
`ROADMAP.md` M0–M3, itself derived from the automated architecture audit. See
[architecture hardening](/initiatives/architecture-hardening.md) for the effort
this reviewed.

# Scope delivered

| Milestone | Delivered | Behaviour change |
|---|---|---|
| M0 | `hooks/executor.ts` split; core `chunkText` + golden oracle tests; `GatewayConfigurationError` base; discord `split.ts` extracted + pin; 4 missing `errors.test.ts` pins | none |
| M1 | 6 `split.ts` migrated — slack/whatsapp/teams/discord to `chunkText`, line/sms to `chunkByGrapheme`; telegram left distinct | minor, golden-pinned identical |
| M2 | 4 `ConfigurationError` classes (line/matrix/mattermost/sms) extend the core base | minor, pin-identical |
| M3 | ADR-0001, ADR-0002, docstring pointer; final gate | none |

# Gates (evidence)

- `pnpm -r typecheck` → 11/11 done
- `pnpm -r build` → 33/33 success (CJS + ESM + DTS × 11)
- `pnpm -r test` → **583 passed**, against a 543 baseline; +40 net
- `biome check packages/` → clean, 194 files
- `madge --circular` → **0 cycles**, 87 files
- Checklist: no deep imports into core; core SDK-agnostic (0 platform-SDK
  imports); no new `package.json` exports subpaths; no generic folders

# The two adversarial lenses

**1 — Behaviour preservation.** Verified byte-identical across 40k+
boundary-fuzz cases and 30k grapheme-fuzz cases, plus targeted edges: a
surrogate or grapheme landing at the window edge, the `< window*0.5` fallback,
`<= 0` versus `< half` as last resort, `/^\s+/` versus `/^\n+/` stripping, and
the `trimParts` filter. It also inspected the **compiled JavaScript** for the
`name` override under `useDefineForClassFields`, rather than trusting the
TypeScript source. No divergence found. The corpus was hardened with three extra
edge inputs.

**2 — Correctness and API design.** Found and fixed two real defects in
[`chunkText`](/core-api/chunk-text.md):

- **HIGH** — `chunkText(limit <= 0)` **infinite-looped**. Now throws `RangeError`,
  failing fast at the boundary. Adversarially re-verified: 5 of 5 invalid inputs
  throw, no hang.
- **MEDIUM** — `safeLimit > limit` broke the hard-cap contract by emitting an
  oversized tail. Now rejected.
- **LOW (accepted)** — the option surface is flexible; all six in-repo call sites
  use it correctly and are tested.
- **Completeness** — every new export is consumed. No dead code, no stubs.

# Honesty corrections against the audit

The two corrections that changed what the milestones actually meant:

1. **M2 was 8 packages in the audit; only 4 actually had the class**, verified by
   grep. The other four hold send-error mappers. See
   [`GatewayConfigurationError`](/core-api/gateway-configuration-error.md).
2. **The audit implied a 2-family split; the real shape is 3** — Slack,
   Telegram, grapheme. [gateway-discord](/packages/gateway-discord.md) is
   Telegram-family, not Slack-family. This is reflected in the
   [`chunkText`](/core-api/chunk-text.md) options.

# Residual, non-blocking

- **Pre-existing.** `examples/` is not a workspace member and has 0 tests; it
  carries roughly 79 biome violations including non-auto-fixable complexity. Root
  `pnpm check` was already red before this work. The milestone gate was scoped to
  `packages/`, which is green.
- **Pre-existing.** `biome.json` schema drift (2.4.15 against CLI 2.5.0) —
  informational only.
- **Noted.** The SMS `(i/N)` prefix reserves 8 characters; at 100 or more parts
  (a message beyond ~158,000 characters) a part can exceed the limit by 2.
  Pre-existing, SMS-specific, byte-identical to before, out of scope. See
  [gateway-sms](/packages/gateway-sms.md).

# Verdict rationale

All M0–M3 definitions of done met with evidence; zero regressions; both review
lenses passed after remediation. Behaviour preserved byte-for-byte where
required, and the new primitives validated on their own merits.
**READY_TO_MERGE.**

The review explicitly did **not** perform the release — that is the
human-approval gate, and it happened separately as
[v1.9.0](/releases/v1-9-0.md).

[^record]: Original review record, absorbed from the untracked knowledge base
