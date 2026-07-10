/**
 * Pin test for `@theokit/gateway-line` errors (roadmap M0, step 5).
 * Captures current behavior before the M2 migration onto the core
 * `GatewayConfigurationError` base.
 */

import { describe, expect, it } from "vitest";

import { ConfigurationError, SDKNotInstalledError } from "../src/errors.js";

describe("gateway-line ConfigurationError", () => {
  it("has name, code, and default prefixed message", () => {
    const e = new ConfigurationError({ code: "missing_secret" });
    expect(e.name).toBe("ConfigurationError");
    expect(e.code).toBe("missing_secret");
    expect(e.message).toBe("gateway-line: missing_secret");
    expect(e.detail).toBeUndefined();
    expect(e).toBeInstanceOf(Error);
  });

  it("honors explicit message + detail", () => {
    const e = new ConfigurationError({ code: "c", message: "m", detail: "d" });
    expect(e.message).toBe("m");
    expect(e.detail).toBe("d");
  });
});

describe("gateway-line SDKNotInstalledError", () => {
  it("carries install hint and extends ConfigurationError", () => {
    const e = new SDKNotInstalledError("@line/bot-sdk");
    expect(e).toBeInstanceOf(ConfigurationError);
    expect(e.code).toBe("sdk_not_installed");
    expect(e.detail).toBe("@line/bot-sdk");
    expect(e.message).toBe(
      'gateway-line: peer-dep "@line/bot-sdk" not installed. Run: pnpm add @line/bot-sdk',
    );
  });
});
