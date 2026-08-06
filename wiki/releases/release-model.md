---
type: Process
title: Release model
description: How this repo actually cuts releases — a repo tag on develop, and separately a per-package Changesets publish to npm.
tags: [process, release, changesets, versioning]
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: v190
    resource: /releases/v1-9-0.md
    title: v1.9.0 repo tag, which recorded the no-main-branch model
  - id: npm050
    resource: /releases/theokit-gateway-0-5-0-npm.md
    title: "@theokit/gateway@0.5.0 publish, which recorded the peer-cascade reasoning"
  - id: scripts
    resource: package.json
    title: Root workspace scripts
---

This repo ships through **two independent release channels**. Conflating them is
the mistake the July 2026 records exist to prevent: a repo tag is not a publish,
and a publish is not a repo tag.

# Channel 1 — repo v-tag on `develop`

The repo has **no `main` branch**. v1.7.0, v1.7.1, v1.8.0 and
[v1.9.0](/releases/v1-9-0.md) all sit on the develop line, so a release is cut by
tagging `develop` directly rather than through a `develop → main` PR.[^v190]

This is a real divergence from the generic cycle contract, which assumes the PR
path and a protected `main`. Read the cycle rules with that substitution in mind;
the human-approval gate still applies, it just does not take the shape of a
release PR here.

A repo tag marks a **milestone of the codebase**. It publishes nothing.

# Channel 2 — per-package Changesets publish to npm

Publishing runs through **Changesets**, which is also what produces the
per-package tag convention (`@theokit/gateway@0.5.0`, not `v0.5.0`).[^npm050]

```bash
pnpm changeset          # record the intent + bump level
pnpm version-packages   # changeset version — apply bumps, rewrite CHANGELOGs
pnpm release            # build, then changeset publish
```

Those are the root scripts.[^scripts]

# The peer-dependency cascade — the trap this model has

Adapters declare [`@theokit/gateway`](/packages/theokit-gateway.md) as a
**`workspace:^` peer dependency**. That single fact governs every publish
decision in the cluster:

$$\text{core minor bump} \;\notin\; \text{adapter peer range} \;\Rightarrow\; \text{Changesets marks each dependent breaking}$$

So a routine core **minor** — 0.4.1 to 0.5.0 — would cascade a **major**
(v1.0.0) onto all ten adapters, broadcasting a breaking change that did not
happen. The July publish handled it by shipping **core only** and leaving the
adapters at their existing versions.

The rule that falls out: **do not republish adapters merely because core moved.**
Republish an adapter when it has its own change to ship, and widen the peer range
in that same release.

# Reading a release record

Each record under this folder states its `release_kind` in frontmatter —
`repo-tag` or `npm-publish` — precisely so the two are never read as one event.
[v1.9.0](/releases/v1-9-0.md) and
[`@theokit/gateway@0.5.0`](/releases/theokit-gateway-0-5-0-npm.md) happened on
the same day, for the same work, and are still two different facts.

# Credential handling

Both July records document an npm token pasted in plaintext during the session.
The standing lesson: a token that reaches a conversation transcript is
compromised regardless of how briefly it was used, and must be revoked and
rotated. Neither the token nor any fragment of it is recorded in this bundle.

[^v190]: v1.9.0 repo tag record
[^npm050]: `@theokit/gateway@0.5.0` publish record
[^scripts]: Root workspace scripts, `package.json`
