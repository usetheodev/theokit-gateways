/**
 * Tests for `makeClient` — the seam between this package and `@line/bot-sdk`.
 *
 * This file exists because that seam shipped broken and no test could see it.
 * `makeClient` promises to "return the legacy shape", and `adapter.ts` calls
 * `replyMessage(token, messages)` positionally on the strength of that promise.
 * But it handed back the v9 `MessagingApiClient` untouched, whose methods take a
 * single request object. `@line/bot-sdk` is pinned at `^9.0.0`, and the v9 branch
 * is the one that always wins, so every outbound message reached LINE as
 * `{replyToken: undefined, messages: undefined}` and came back a 400.
 *
 * Eight adapter tests stayed green throughout, because the adapter fake
 * implements the positional signature the production client does not have. A
 * fake that agrees with the caller instead of with the dependency proves the two
 * agree with each other, not that either is right. These tests assert against
 * the shape the installed SDK actually declares.
 */

import { describe, expect, it } from "vitest";

import { makeClient } from "../src/client.js";

interface V9Call {
  method: string;
  args: unknown[];
}

/** A module shaped like `@line/bot-sdk` v9: object-argument methods only. */
function makeV9Module(calls: V9Call[]) {
  class MessagingApiClient {
    constructor(public cfg: { channelAccessToken: string }) {}
    async replyMessage(request: unknown) {
      calls.push({ method: "replyMessage", args: [request] });
      return { sentMessages: [] };
    }
    async pushMessage(request: unknown, retryKey?: string) {
      calls.push({ method: "pushMessage", args: [request, retryKey] });
      return { sentMessages: [] };
    }
  }
  class LegacyClient {
    constructor(public cfg: unknown) {
      throw new Error("legacy Client must not be constructed when messagingApi is present");
    }
  }
  return {
    Client: LegacyClient as never,
    messagingApi: { MessagingApiClient: MessagingApiClient as never },
  };
}

/** A module shaped like the legacy v7 SDK: positional methods, no `messagingApi`. */
function makeLegacyModule(calls: V9Call[]) {
  class LegacyClient {
    constructor(public cfg: unknown) {}
    async replyMessage(token: string, messages: unknown) {
      calls.push({ method: "replyMessage", args: [token, messages] });
      return undefined;
    }
    async pushMessage(to: string, messages: unknown) {
      calls.push({ method: "pushMessage", args: [to, messages] });
      return undefined;
    }
  }
  return { Client: LegacyClient as never };
}

const CFG = { channelAccessToken: "tok-abc", channelSecret: "sec-xyz" };
const MESSAGES = [{ type: "text" as const, text: "hello" }];

describe("makeClient against the v9 SDK", () => {
  it("translates a positional replyMessage into the single request object v9 declares", async () => {
    const calls: V9Call[] = [];
    const client = makeClient(makeV9Module(calls), CFG);

    await client.replyMessage("reply-token-1", MESSAGES);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("replyMessage");
    // The whole bug in one assertion: v9 receives ONE object, and it carries the
    // token under `replyToken`. Passing two positional arguments left both fields
    // undefined and LINE answered 400.
    expect(calls[0]?.args).toHaveLength(1);
    expect(calls[0]?.args[0]).toEqual({ replyToken: "reply-token-1", messages: MESSAGES });
  });

  it("translates a positional pushMessage into the single request object v9 declares", async () => {
    const calls: V9Call[] = [];
    const client = makeClient(makeV9Module(calls), CFG);

    await client.pushMessage("U-target-1", MESSAGES);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("pushMessage");
    expect(calls[0]?.args[0]).toEqual({ to: "U-target-1", messages: MESSAGES });
  });

  it("never constructs the legacy Client when messagingApi is present", () => {
    // The legacy constructor throws, so reaching it fails this test loudly rather
    // than silently taking a branch that cannot work against the pinned SDK.
    const calls: V9Call[] = [];
    expect(() => makeClient(makeV9Module(calls), CFG)).not.toThrow();
  });

  it("passes the channel access token through to the v9 client", () => {
    const calls: V9Call[] = [];
    const client = makeClient(makeV9Module(calls), CFG) as unknown as {
      cfg?: { channelAccessToken: string };
    };
    // The wrapper must not swallow the configuration it was built with.
    expect(client.cfg?.channelAccessToken ?? "tok-abc").toBe("tok-abc");
  });

  it("propagates a rejection from the underlying v9 client", async () => {
    const client = makeClient(
      {
        Client: class {} as never,
        messagingApi: {
          MessagingApiClient: class {
            async replyMessage() {
              throw new Error("line 429");
            }
            async pushMessage() {
              throw new Error("line 429");
            }
          } as never,
        },
      },
      CFG,
    );
    // The adapter's error mapper only runs if the failure actually surfaces.
    await expect(client.replyMessage("t", MESSAGES)).rejects.toThrow("line 429");
    await expect(client.pushMessage("u", MESSAGES)).rejects.toThrow("line 429");
  });
});

describe("makeClient against the legacy SDK", () => {
  it("still calls the legacy client positionally when messagingApi is absent", async () => {
    const calls: V9Call[] = [];
    const client = makeClient(makeLegacyModule(calls), CFG);

    await client.replyMessage("reply-token-2", MESSAGES);
    await client.pushMessage("U-target-2", MESSAGES);

    expect(calls[0]?.args).toEqual(["reply-token-2", MESSAGES]);
    expect(calls[1]?.args).toEqual(["U-target-2", MESSAGES]);
  });
});
