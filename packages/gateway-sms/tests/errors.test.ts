/**
 * Pin test for `@theokit/gateway-sms` errors (roadmap M0, step 5).
 * Captures current behavior before the M2 migration onto the core
 * `GatewayConfigurationError` base.
 */

import { describe, expect, it } from "vitest";

import { BackendNotInstalledError, ConfigurationError } from "../src/errors.js";

describe("gateway-sms ConfigurationError", () => {
  it("has name, code, and default prefixed message", () => {
    const e = new ConfigurationError({ code: "bad_number" });
    expect(e.name).toBe("ConfigurationError");
    expect(e.code).toBe("bad_number");
    expect(e.message).toBe("gateway-sms: bad_number");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("gateway-sms BackendNotInstalledError", () => {
  it("names the selected backend and install hint", () => {
    const e = new BackendNotInstalledError("twilio", "twilio");
    expect(e).toBeInstanceOf(ConfigurationError);
    expect(e.code).toBe("backend_not_installed");
    expect(e.detail).toBe("twilio");
    expect(e.message).toBe(
      'gateway-sms: peer-dep "twilio" not installed but backend="twilio" was selected. Run: pnpm add twilio',
    );
  });
});
