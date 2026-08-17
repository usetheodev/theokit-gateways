/**
 * Signature verification for the three SMS backends — the inbound webhook auth
 * boundary.
 *
 * This file exists because that boundary had NO test. No test imported
 * `../src/backend/{twilio,plivo,vonage}.js` at all: 481 lines carrying all three
 * HMAC verifiers were never loaded by the suite. The one test named for
 * signatures used a fake backend whose `verifySignature` was `return true`
 * unconditionally, so it proved the adapter delegates — not that anything
 * verifies.
 *
 * The consequence is the kind that does not announce itself: invert
 * `if (signature === undefined) return false`, or flip a `catch { return false }`
 * to `true`, and every test in the package still passes while forged inbound SMS
 * is accepted as genuine.
 *
 * Each provider SDK is mocked, because the assertion here is about THIS code:
 * that the right credential reaches the verifier, that a missing header is a
 * refusal rather than a pass, and that failure modes fail closed. The SDKs have
 * their own tests for the cryptography.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SignatureContext } from "../src/backend-types.js";

const validateRequest = vi.fn();
const validateV3Signature = vi.fn();
const vonageVerifySignature = vi.fn();

vi.mock("twilio", () => {
  const factory = Object.assign(() => ({ messages: { create: vi.fn() } }), { validateRequest });
  return { default: factory };
});

vi.mock("plivo", () => ({
  validateV3Signature,
  Client: class {
    messages = { create: vi.fn() };
  },
}));

vi.mock("@vonage/server-sdk", () => ({
  Auth: { verifySignature: vonageVerifySignature },
  Vonage: class {
    sms = { send: vi.fn() };
  },
}));

const { TwilioBackend } = await import("../src/backend/twilio.js");
const { PlivoBackend } = await import("../src/backend/plivo.js");
const { VonageBackend } = await import("../src/backend/vonage.js");

function ctx(overrides: Partial<SignatureContext> = {}): SignatureContext {
  return {
    headers: {},
    rawBody: "From=%2B5511999999999&To=%2B5511888888888&Body=hi&MessageSid=SM1",
    url: "https://example.test/sms/inbound",
    ...overrides,
  };
}

beforeEach(() => {
  validateRequest.mockReset();
  validateV3Signature.mockReset();
  vonageVerifySignature.mockReset();
});

describe("TwilioBackend.verifySignature", () => {
  async function connected() {
    const backend = new TwilioBackend({
      backend: "twilio",
      publicUrl: "https://example.test/sms/inbound",
      accountSid: "AC-sid",
      authToken: "auth-token-1",
      fromNumber: "+5511888888888",
    });
    await backend.connect();
    return backend;
  }

  it("refuses a request with no signature header, without consulting the SDK", async () => {
    const backend = await connected();
    expect(backend.verifySignature(ctx())).toBe(false);
    // Fails closed BEFORE the verifier: a missing header is not a question to ask.
    expect(validateRequest).not.toHaveBeenCalled();
  });

  it("refuses before connect(), when the SDK is not loaded", async () => {
    const backend = new TwilioBackend({
      backend: "twilio",
      publicUrl: "https://example.test/sms/inbound",
      accountSid: "AC-sid",
      authToken: "auth-token-1",
      fromNumber: "+5511888888888",
    });
    expect(backend.verifySignature(ctx({ headers: { "x-twilio-signature": "sig" } }))).toBe(false);
  });

  it("passes the auth token, the exact URL and the parsed params to the verifier", async () => {
    const backend = await connected();
    validateRequest.mockReturnValue(true);

    const ok = backend.verifySignature(ctx({ headers: { "x-twilio-signature": "sig-abc" } }));

    expect(ok).toBe(true);
    expect(validateRequest).toHaveBeenCalledTimes(1);
    const [token, signature, url, params] = validateRequest.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, string>,
    ];
    // Twilio's HMAC is over the URL plus the sorted params. Passing the wrong
    // token, a rewritten URL, or unparsed params all produce a verifier that
    // says "valid" for the wrong reason.
    expect(token).toBe("auth-token-1");
    expect(signature).toBe("sig-abc");
    expect(url).toBe("https://example.test/sms/inbound");
    expect(params.From).toBe("+5511999999999");
    expect(params.Body).toBe("hi");
  });

  it("refuses when the verifier says the signature is invalid", async () => {
    const backend = await connected();
    validateRequest.mockReturnValue(false);
    expect(backend.verifySignature(ctx({ headers: { "x-twilio-signature": "wrong" } }))).toBe(
      false,
    );
  });

  it("fails closed when the verifier throws", async () => {
    const backend = await connected();
    validateRequest.mockImplementation(() => {
      throw new Error("malformed signature");
    });
    // A verifier that throws must never be read as a pass.
    expect(backend.verifySignature(ctx({ headers: { "x-twilio-signature": "junk" } }))).toBe(false);
  });
});

describe("PlivoBackend.verifySignature", () => {
  async function connected() {
    const backend = new PlivoBackend({
      backend: "plivo",
      publicUrl: "https://example.test/sms/inbound",
      authId: "MA-id",
      authToken: "plivo-token-1",
      fromNumber: "+5511888888888",
    });
    await backend.connect();
    return backend;
  }

  it("refuses when the signature header is absent", async () => {
    const backend = await connected();
    expect(backend.verifySignature(ctx({ headers: { "x-plivo-signature-v3-nonce": "n" } }))).toBe(
      false,
    );
    expect(validateV3Signature).not.toHaveBeenCalled();
  });

  it("refuses when the nonce header is absent", async () => {
    // V3 binds the signature to a nonce. Accepting a signature without one
    // reopens the replay window the nonce exists to close.
    const backend = await connected();
    expect(backend.verifySignature(ctx({ headers: { "x-plivo-signature-v3": "sig" } }))).toBe(
      false,
    );
    expect(validateV3Signature).not.toHaveBeenCalled();
  });

  it("passes method, URL, nonce and auth token to the verifier", async () => {
    const backend = await connected();
    validateV3Signature.mockReturnValue(true);

    const ok = backend.verifySignature(
      ctx({
        headers: { "x-plivo-signature-v3": "sig-xyz", "x-plivo-signature-v3-nonce": "nonce-1" },
      }),
    );

    expect(ok).toBe(true);
    const [method, url, nonce, token, signature] = validateV3Signature.mock.calls[0] as string[];
    expect(method).toBe("POST");
    expect(url).toBe("https://example.test/sms/inbound");
    expect(nonce).toBe("nonce-1");
    expect(token).toBe("plivo-token-1");
    expect(signature).toBe("sig-xyz");
  });

  it("fails closed when the verifier throws", async () => {
    const backend = await connected();
    validateV3Signature.mockImplementation(() => {
      throw new Error("bad nonce");
    });
    expect(
      backend.verifySignature(
        ctx({ headers: { "x-plivo-signature-v3": "s", "x-plivo-signature-v3-nonce": "n" } }),
      ),
    ).toBe(false);
  });
});

describe("VonageBackend.verifySignature", () => {
  async function connected() {
    const backend = new VonageBackend({
      backend: "vonage",
      publicUrl: "https://example.test/sms/inbound",
      apiKey: "key",
      apiSecret: "secret",
      signatureSecret: "sig-secret-1",
      fromNumber: "Theo",
    });
    await backend.connect();
    return backend;
  }

  it("refuses when the Authorization header is absent", async () => {
    const backend = await connected();
    expect(backend.verifySignature(ctx())).toBe(false);
    expect(vonageVerifySignature).not.toHaveBeenCalled();
  });

  it.each([
    ["not a bearer scheme", "Basic abc123"],
    ["bearer with an empty token", "Bearer "],
  ])("refuses when the header is %s", async (_label, authorization) => {
    const backend = await connected();
    expect(backend.verifySignature(ctx({ headers: { authorization } }))).toBe(false);
    expect(vonageVerifySignature).not.toHaveBeenCalled();
  });

  it("verifies the JWT against the SIGNATURE secret, not the API secret", async () => {
    // Vonage signs with the Signature Secret; verifying against the API secret
    // would reject every genuine callback, or worse, accept on a shared value.
    const backend = await connected();
    vonageVerifySignature.mockReturnValue(true);

    const ok = backend.verifySignature(ctx({ headers: { authorization: "Bearer jwt.abc.def" } }));

    expect(ok).toBe(true);
    const [token, secret] = vonageVerifySignature.mock.calls[0] as string[];
    expect(token).toBe("jwt.abc.def");
    expect(secret).toBe("sig-secret-1");
  });

  it("accepts the scheme case-insensitively, as HTTP requires", async () => {
    const backend = await connected();
    vonageVerifySignature.mockReturnValue(true);
    expect(backend.verifySignature(ctx({ headers: { authorization: "bearer jwt.abc" } }))).toBe(
      true,
    );
  });

  it("fails closed when the verifier throws", async () => {
    const backend = await connected();
    vonageVerifySignature.mockImplementation(() => {
      throw new Error("expired");
    });
    expect(backend.verifySignature(ctx({ headers: { authorization: "Bearer jwt" } }))).toBe(false);
  });
});

describe("parseInbound", () => {
  it("Twilio parses form-encoded bodies into the canonical shape", async () => {
    const backend = new TwilioBackend({
      backend: "twilio",
      publicUrl: "https://example.test/sms/inbound",
      accountSid: "AC",
      authToken: "t",
      fromNumber: "+5511888888888",
    });
    const inbound = backend.parseInbound(ctx());
    expect(inbound.from).toBe("+5511999999999");
    expect(inbound.to).toBe("+5511888888888");
    expect(inbound.body).toBe("hi");
    expect(inbound.messageId).toBe("SM1");
  });

  it("Plivo parses a JSON body when the content type says so", async () => {
    const backend = new PlivoBackend({
      backend: "plivo",
      publicUrl: "https://example.test/sms/inbound",
      authId: "MA",
      authToken: "t",
      fromNumber: "+5511888888888",
    });
    const inbound = backend.parseInbound(
      ctx({
        headers: { "content-type": "application/json" },
        rawBody: JSON.stringify({
          From: "+5511999999999",
          To: "+5511888888888",
          Text: "json hi",
          MessageUUID: "uuid-1",
        }),
      }),
    );
    expect(inbound.from).toBe("+5511999999999");
    expect(inbound.body).toBe("json hi");
  });

  it("rejects an unparseable body rather than inventing an empty message", async () => {
    // The JSON parse itself is caught (params falls back to {}), but the empty
    // sender is then refused by normalizeE164. That refusal is correct: a
    // webhook whose sender cannot be determined is not a message, and
    // fabricating one with an empty `from` would put a phantom event on the
    // agent's inbound path. `webhook-server.ts` maps this throw to a 400, so
    // the provider sees a client error and does not retry it as a 500 —
    // asserted in `webhook-server.test.ts`.
    const backend = new PlivoBackend({
      backend: "plivo",
      publicUrl: "https://example.test/sms/inbound",
      authId: "MA",
      authToken: "t",
      fromNumber: "+5511888888888",
    });
    expect(() =>
      backend.parseInbound(
        ctx({ headers: { "content-type": "application/json" }, rawBody: "{not json" }),
      ),
    ).toThrow(/phone number is empty/);
  });
});
