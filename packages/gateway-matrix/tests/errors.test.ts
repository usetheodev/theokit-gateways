/**
 * Pin test for `@theokit/gateway-matrix` errors (roadmap M0, step 5).
 * Captures current behavior before the M2 migration onto the core
 * `GatewayConfigurationError` base.
 */

import { describe, expect, it } from "vitest";

import { ConfigurationError, EncryptedRoomError, SDKNotInstalledError } from "../src/errors.js";

describe("gateway-matrix ConfigurationError", () => {
  it("has name, code, and default prefixed message", () => {
    const e = new ConfigurationError({ code: "bad_config" });
    expect(e.name).toBe("ConfigurationError");
    expect(e.code).toBe("bad_config");
    expect(e.message).toBe("gateway-matrix: bad_config");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("gateway-matrix SDKNotInstalledError", () => {
  it("hardcodes the matrix-js-sdk install hint", () => {
    const e = new SDKNotInstalledError();
    expect(e).toBeInstanceOf(ConfigurationError);
    expect(e.code).toBe("sdk_not_installed");
    expect(e.detail).toBe("matrix-js-sdk");
    expect(e.message).toBe(
      'gateway-matrix: peer-dep "matrix-js-sdk" not installed. Run: pnpm add matrix-js-sdk',
    );
  });
});

describe("gateway-matrix EncryptedRoomError", () => {
  it("carries the room id and E2EE-deferred message", () => {
    const e = new EncryptedRoomError("!room:server");
    expect(e).toBeInstanceOf(ConfigurationError);
    expect(e.code).toBe("encrypted_room_unsupported");
    expect(e.detail).toBe("!room:server");
    expect(e.message).toBe(
      "gateway-matrix: room !room:server is end-to-end encrypted (E2EE deferred to v0.2)",
    );
  });
});
