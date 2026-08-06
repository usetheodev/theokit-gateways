---
type: TypeScript Class
title: GatewayConfigurationError
description: Shared base for per-adapter configuration errors — one code/detail contract instead of a class body copy-pasted across packages.
resource: packages/gateway/src/errors/config-error.ts
tags: [core, public-api, errors, dry]
generated: { by: claude-code/claude-opus-5, at: 2026-08-06T18:23:33Z }
sources:
  - id: code
    resource: packages/gateway/src/errors/config-error.ts
    title: "GatewayConfigurationError source, @theokit/gateway"
  - id: extenders
    resource: "packages/gateway-{line,matrix,mattermost,sms}/src/errors.ts at c891696"
    title: The four adapter subclasses, verified by grep
  - id: review
    resource: /reviews/architecture-hardening-2026-07-10.md
    title: Architecture-hardening review, which corrected the 8-vs-4 count
---

`GatewayConfigurationError` is the base every adapter's `ConfigurationError`
extends. Before milestone M2 of the
[architecture-hardening effort](/initiatives/architecture-hardening.md), each
adapter defined an identical `ConfigurationError extends Error` — same
`code`/`detail` fields, same options interface, same `` `${pkg}: ${code}` ``
default message. Only the package prefix differed. This base single-sources that
contract.[^code]

It is **not thrown directly** by adapters. They subclass it, pin their prefix,
keep `name = "ConfigurationError"`, and hang their own subclasses off it
(`SDKNotInstalledError`, `BackendNotInstalledError`, …).

# Schema — `GatewayConfigurationErrorOptions`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `code` | `string` | yes | Machine-readable error code. |
| `message` | `string?` | no | Explicit message. When absent the default is `` `${prefix}: ${code}` ``. |
| `detail` | `string?` | no | Human-readable elaboration. |

# Schema — the class

| Member | Type | Notes |
|---|---|---|
| `name` | `string` | Declared `override readonly`, defaults to `"GatewayConfigurationError"`. Subclasses override it to `"ConfigurationError"`. |
| `code` | `string` | Copied from the options. |
| `detail` | `string \| undefined` | Copied from the options. |
| `constructor(prefix, opts)` | — | `prefix` is the package prefix used in the default message, e.g. `"gateway-line"`. |

```typescript
export class GatewayConfigurationError extends Error {
  override readonly name: string = "GatewayConfigurationError";
  readonly code: string;
  readonly detail: string | undefined;

  constructor(prefix: string, opts: GatewayConfigurationErrorOptions) {
    super(opts.message ?? `${prefix}: ${opts.code}`);
    this.code = opts.code;
    this.detail = opts.detail;
  }
}
```

The `override readonly name` declaration is load-bearing under
`useDefineForClassFields`, which changes whether a subclass field declaration
assigns or shadows. The review verified the compiled JavaScript for exactly this
reason rather than trusting the TypeScript source.[^review]

# Who extends it

Four adapters, not eight. The architecture audit that motivated the milestone
claimed eight packages carried the class; a grep during review found only four
actually did — the other four hold send-error mappers instead. The correction is
recorded in the review's honesty section.[^extenders]

- [gateway-line](/packages/gateway-line.md)
- [gateway-matrix](/packages/gateway-matrix.md)
- [gateway-mattermost](/packages/gateway-mattermost.md)
- [gateway-sms](/packages/gateway-sms.md)

Each re-exports `ConfigurationErrorOptions` as an alias of
`GatewayConfigurationErrorOptions`, so the public option shape is literally the
same type rather than a structurally-similar copy.

# Why a consumer cares

A downstream bot author gets one `instanceof GatewayConfigurationError` check
that spans every adapter, instead of importing four unrelated classes that
happen to look alike. That was the stated secondary benefit of the hardening
effort for consumers of [`@theokit/gateway`](/packages/theokit-gateway.md).

[^code]: `GatewayConfigurationError` source, `@theokit/gateway`
[^extenders]: The four adapter subclasses, verified by grep at `c891696`
[^review]: Architecture-hardening review, 2026-07-10
