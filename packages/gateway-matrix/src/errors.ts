/**
 * Typed errors for `@theokit/gateway-matrix`.
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
    super("gateway-matrix", opts);
  }
}

export class SDKNotInstalledError extends ConfigurationError {
  constructor() {
    super({
      code: "sdk_not_installed",
      message:
        'gateway-matrix: peer-dep "matrix-js-sdk" not installed. Run: pnpm add matrix-js-sdk',
      detail: "matrix-js-sdk",
    });
  }
}

export class EncryptedRoomError extends ConfigurationError {
  constructor(roomId: string) {
    super({
      code: "encrypted_room_unsupported",
      message: `gateway-matrix: room ${roomId} is end-to-end encrypted (E2EE deferred to v0.2)`,
      detail: roomId,
    });
  }
}
