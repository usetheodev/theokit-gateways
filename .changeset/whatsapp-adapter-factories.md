---
"@theokit/gateway-whatsapp": minor
---

**`WhatsAppAdapter.fromCloud()` and `.fromWeb()` now exist.** The class docblock has instructed consumers to call them since the package was written, and neither did. Three exported types described that API — `WhatsAppAdapterOptions`, `WhatsAppCloudConfig`, `WhatsAppWebConfig` — and no source file consumed any of them. Anyone following the only construction guidance the package gave wrote code that did not compile.

The factories build the backend and delegate to the constructor, so a consumer stops importing `WhatsAppCloudBackend` to pass it in. The constructor stays for tests and for a backend of your own.

They also validate. `fromCloud` with an empty `accessToken` now throws `ConfigurationError` at construction rather than returning an adapter that fails later against the network — a factory that hands back something which cannot authenticate has moved the error away from its cause, so the stack names a send when the mistake was in construction. `ConfigurationError` extends the core's `GatewayConfigurationError` and carries this package's prefix, matching every sibling adapter, so one `catch` works across all of them.

`WhatsAppAdapterOptions` was reshaped: the union now carries only what differs between backends. `requireMention`, `botPhoneId` and `allowedSenders` mean the same thing on either one and moved to `WhatsAppAdapterCommonOptions`, so there is one copy rather than one per arm for the two to drift apart. Nothing consumed the type before, so no caller can break.

Worth naming why the alternative was rejected: deleting the promise and documenting the real constructor was cheaper and equally honest, and it was the front-runner until a third backend became concrete. With three, picking one by a string discriminator is the ergonomics the union was written for.

`quality:doc-coverage` read 100% throughout, because it measures whether a docblock exists and not whether it is true.
