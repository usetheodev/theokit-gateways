/**
 * `GatewayConfigurationError` — shared base for per-adapter configuration
 * errors (roadmap M0/M2).
 *
 * Every platform adapter previously defined an identical
 * `ConfigurationError extends Error` (same `code`/`detail` fields, same
 * options interface, same `` `${pkg}: ${code}` `` default message) — only the
 * package prefix differed. This base single-sources that contract. Adapters
 * extend it, pin their prefix, and keep `name = "ConfigurationError"` plus
 * their own subclasses (`SDKNotInstalledError`, `BackendNotInstalledError`, …).
 *
 * @public
 */

/** Public input shape for the {@link GatewayConfigurationError} constructor. */
export interface GatewayConfigurationErrorOptions {
  readonly code: string;
  readonly message?: string;
  readonly detail?: string;
}

/**
 * Base configuration error. Not thrown directly by adapters — they subclass it
 * with a fixed package prefix.
 */
export class GatewayConfigurationError extends Error {
  override readonly name: string = "GatewayConfigurationError";
  readonly code: string;
  readonly detail: string | undefined;

  /**
   * @param prefix Package prefix used in the default message (e.g. `"gateway-line"`).
   * @param opts   `code` (required), optional explicit `message`, optional `detail`.
   */
  constructor(prefix: string, opts: GatewayConfigurationErrorOptions) {
    super(opts.message ?? `${prefix}: ${opts.code}`);
    this.code = opts.code;
    this.detail = opts.detail;
  }
}
