/**
 * Pin test for `@theokit/gateway-mattermost` errors (roadmap M0, step 5).
 * Captures current behavior before the M2 migration onto the core
 * `GatewayConfigurationError` base.
 */

import { describe, expect, it } from "vitest";

import { ConfigurationError, SDKNotInstalledError } from "../src/errors.js";

describe("gateway-mattermost ConfigurationError", () => {
  it("has name, code, and default prefixed message", () => {
    const e = new ConfigurationError({ code: "missing_token" });
    expect(e.name).toBe("ConfigurationError");
    expect(e.code).toBe("missing_token");
    expect(e.message).toBe("gateway-mattermost: missing_token");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("gateway-mattermost SDKNotInstalledError", () => {
  it("carries install hint and extends ConfigurationError", () => {
    const e = new SDKNotInstalledError("@mattermost/client");
    expect(e).toBeInstanceOf(ConfigurationError);
    expect(e.code).toBe("sdk_not_installed");
    expect(e.detail).toBe("@mattermost/client");
    expect(e.message).toBe(
      'gateway-mattermost: peer-dep "@mattermost/client" not installed. Run: pnpm add @mattermost/client',
    );
  });
});
