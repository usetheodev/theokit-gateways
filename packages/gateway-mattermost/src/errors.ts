/**
 * Typed errors for `@theokit/gateway-mattermost`.
 *
 * `ConfigurationError` extends the shared core `GatewayConfigurationError`
 * base (roadmap M2). Behavior byte-identical (pinned by `tests/errors.test.ts`).
 */

import { GatewayConfigurationError, type GatewayConfigurationErrorOptions } from "@theokit/gateway";

/** @knipignore — public input shape for `ConfigurationError` constructor (caller-extensible). */
export type ConfigurationErrorOptions = GatewayConfigurationErrorOptions;

export class ConfigurationError extends GatewayConfigurationError {
  override readonly name = "ConfigurationError";
  constructor(opts: ConfigurationErrorOptions) {
    super("gateway-mattermost", opts);
  }
}

export class SDKNotInstalledError extends ConfigurationError {
  constructor(pkgName: string) {
    super({
      code: "sdk_not_installed",
      message: `gateway-mattermost: peer-dep "${pkgName}" not installed. Run: pnpm add ${pkgName}`,
      detail: pkgName,
    });
  }
}
