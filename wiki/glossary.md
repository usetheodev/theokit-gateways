---
type: Glossary
title: Gateway cluster terms
description: The recurring terms across this bundle's decisions, reviews and release records, defined once.
tags: [terminology, reference]
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: recalled
    resource: "producer knowledge at 2026-08-06, not read from a source"
    title: Producer knowledge
  - id: repo
    resource: "packages/ and ROADMAP.md at c891696"
    title: Repository source and roadmap, for the repo-specific senses
---

Terms whose whole story fits in a sentence or two. Anything with its own facts,
history or relationships has its own concept instead — see
[core API](/core-api/message-event.md) and
[packages](/packages/theokit-gateway.md).

# Terms

Adapter
: A package that translates one platform's SDK and event shape into the core
  contract, emitting [`MessageEvent`](/core-api/message-event.md). Ten exist.

Afferent coupling ($C_a$)
: How many modules depend **on** a given module. Core's $C_a = 10$ is why
  [ADR-0001](/decisions/adr-0001-message-event-closed-union.md) treats editing
  it as a real cost.[^recalled]

Backend seam
: The internal interface a multi-backend adapter implements once per provider,
  declared in `backend-types.ts` per
  [ADR-0002](/decisions/adr-0002-type-file-naming-convention.md). Present in
  [gateway-whatsapp](/packages/gateway-whatsapp.md) (Cloud, Web) and
  [gateway-sms](/packages/gateway-sms.md) (Twilio, Plivo, Vonage).

Barrel
: A package's single public entry (`src/index.ts`). Nothing outside it is
  importable — "no deep imports" is a gate the milestone re-checks.

Biome
: The formatter and linter used across the workspace, run as
  `biome check packages/`.[^repo]

Byte-identical
: The bar M1 held itself to: the migrated splitter must return exactly the same
  strings as the copy-pasted one, proved by golden pins and fuzzing rather than
  claimed.

Changesets
: The tool that drives npm publishing and per-package versioning. It produces
  tags like `@theokit/gateway@0.5.0`. See
  [release model](/releases/release-model.md).

Discriminated union
: A union whose members share a literal-typed field (here `platform`) that the
  compiler uses to narrow. The basis of
  [`MessageEvent`](/core-api/message-event.md).

Dist-tag
: An npm pointer such as `latest` that names which version an unqualified
  install resolves to.

E.164
: The international phone-number format (`+` and up to 15 digits) that
  [gateway-sms](/packages/gateway-sms.md) normalizes `from` and `to` into.[^recalled]

Exhaustiveness check
: Assigning the narrowed value to `never` in a `default` branch, so the compiler
  errors when a union member is unhandled. The property
  [ADR-0001](/decisions/adr-0001-message-event-closed-union.md) refuses to give
  up.

Golden / pin test
: A test that records current output as the expected value, so a refactor that
  changes behaviour fails loudly. M0 backfilled these **before** M1 converted
  anything.

Grapheme cluster
: What a reader perceives as one character, which may span several code points —
  an emoji with modifiers, a flag, a base plus combining marks. Segmented via
  `Intl.Segmenter` in
  [`chunkByGrapheme`](/core-api/chunk-by-grapheme.md).[^recalled]

Instability ($I$)
: $I = C_e / (C_a + C_e)$, from 0 (maximally stable) to 1. Core sits at
  $I \approx 0.09$.[^recalled]

`Intl.Segmenter`
: The ECMA-402 API that splits text on grapheme, word or sentence boundaries.
  The engine behind [`chunkByGrapheme`](/core-api/chunk-by-grapheme.md).[^recalled]

madge
: The dependency-graph tool run as `madge --circular` to assert **zero** circular
  dependencies — a standing gate, green at 87 files.[^repo]

Open/Closed Principle (OCP)
: Software should be open to extension and closed to modification.
  [ADR-0001](/decisions/adr-0001-message-event-closed-union.md) is a documented,
  deliberate exception.

Peer dependency
: A dependency the consumer must supply rather than one bundled. Adapters declare
  core as `workspace:^` peer, which is what creates the version cascade described
  in [release model](/releases/release-model.md).

Send-error mapper
: An adapter's `errors.ts` that translates provider error responses into local
  errors. Distinct from a `ConfigurationError` subclass — the confusion between
  the two is what made the audit count 8 packages where only 4 extend
  [`GatewayConfigurationError`](/core-api/gateway-configuration-error.md).

Surrogate pair
: Two UTF-16 code units encoding one character above U+FFFF. Slicing between them
  corrupts it, which `surrogateGuard` in
  [`chunkText`](/core-api/chunk-text.md) prevents.[^recalled]

Tag-on-develop
: This repo's release model: no `main` branch, so v-tags are cut directly on
  `develop`. See [v1.9.0](/releases/v1-9-0.md).

Wiring triad
: The completeness bar used in review — a caller, an integration test, and a
  runtime signal. "Every new export is consumed; no dead code, no stubs" in the
  [review](/reviews/architecture-hardening-2026-07-10.md) is its verdict.

[^recalled]: Producer knowledge, unverified against a source
[^repo]: Repository source and roadmap at `c891696`
