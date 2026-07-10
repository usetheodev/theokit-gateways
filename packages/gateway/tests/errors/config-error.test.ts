/**
 * Tests for `GatewayConfigurationError` (roadmap M0, step 3).
 */

import { describe, expect, it } from "vitest";

import { GatewayConfigurationError } from "../../src/errors/config-error.js";

describe("GatewayConfigurationError", () => {
  it("builds the default message from prefix + code", () => {
    const e = new GatewayConfigurationError("gateway-line", { code: "missing_secret" });
    expect(e.message).toBe("gateway-line: missing_secret");
    expect(e.code).toBe("missing_secret");
    expect(e.detail).toBeUndefined();
    expect(e).toBeInstanceOf(Error);
  });

  it("uses an explicit message when provided and carries detail", () => {
    const e = new GatewayConfigurationError("gateway-x", {
      code: "sdk_not_installed",
      message: "custom message",
      detail: "some-pkg",
    });
    expect(e.message).toBe("custom message");
    expect(e.code).toBe("sdk_not_installed");
    expect(e.detail).toBe("some-pkg");
  });

  it("lets a subclass pin the prefix and override the name (adapter pattern)", () => {
    class ConfigurationError extends GatewayConfigurationError {
      override readonly name = "ConfigurationError";
      constructor(opts: { code: string; message?: string; detail?: string }) {
        super("gateway-line", opts);
      }
    }
    const e = new ConfigurationError({ code: "boom" });
    expect(e.name).toBe("ConfigurationError");
    expect(e.message).toBe("gateway-line: boom");
    expect(e).toBeInstanceOf(ConfigurationError);
    expect(e).toBeInstanceOf(GatewayConfigurationError);
    expect(e).toBeInstanceOf(Error);
  });
});
