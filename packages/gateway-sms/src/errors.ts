/**
 * Typed errors for `@theokit/gateway-sms` (D389-D396).
 *
 * - `ConfigurationError` — programmer error at construction time
 *   (missing signing secret, missing backend SDK install, malformed
 *   phone number on outbound). Thrown synchronously.
 * - `BackendNotInstalledError` — peer-dep optional backend (twilio /
 *   plivo / @vonage/server-sdk) was selected but the npm package is
 *   not installed. Carries actionable install hint.
 *
 * `ConfigurationError` extends the shared core `GatewayConfigurationError`
 * base (roadmap M2); the SDK still consumes structured errors via
 * `metadata.code`. Behavior byte-identical (pinned by `tests/errors.test.ts`).
 *
 * @internal — re-exported by `src/index.ts`.
 */

import { GatewayConfigurationError, type GatewayConfigurationErrorOptions } from "@theokit/gateway";

/** @knipignore — public input shape for `ConfigurationError` constructor (caller-extensible). */
export type ConfigurationErrorOptions = GatewayConfigurationErrorOptions;

export class ConfigurationError extends GatewayConfigurationError {
  override readonly name = "ConfigurationError";
  constructor(opts: ConfigurationErrorOptions) {
    super("gateway-sms", opts);
  }
}

export class BackendNotInstalledError extends ConfigurationError {
  constructor(backend: "twilio" | "plivo" | "vonage", pkgName: string) {
    super({
      code: "backend_not_installed",
      message: `gateway-sms: peer-dep "${pkgName}" not installed but backend="${backend}" was selected. Run: pnpm add ${pkgName}`,
      detail: pkgName,
    });
  }
}
