# Core API

The primitives `@theokit/gateway` exports and every adapter builds on. Each was
either introduced or restructured by the
[architecture-hardening effort](/initiatives/architecture-hardening.md).

## Types

* [MessageEvent](message-event.md) - The canonical inbound event, a closed discriminated union keyed by `platform`.

## Text chunking

* [chunkText](chunk-text.md) - Boundary-preferring chunker; single-sources the Slack and Telegram splitting families.
* [chunkByGrapheme](chunk-by-grapheme.md) - `Intl.Segmenter` grapheme-safe chunker for LINE and SMS.

## Errors

* [GatewayConfigurationError](gateway-configuration-error.md) - Shared base for per-adapter configuration errors.

## Hooks

* [HookExecutor](hook-executor.md) - Runs registered hooks at `pre_inbound`, `post_outbound` and `on_error`.
