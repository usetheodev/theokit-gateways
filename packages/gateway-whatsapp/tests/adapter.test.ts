/**
 * `WhatsAppAdapter` tests (T1.4 + EC-7, EC-8 absorbed).
 */

import { BasePlatformAdapter } from "@theokit/gateway";
import { describe, expect, it, vi } from "vitest";

import { digitsOnly, WhatsAppAdapter } from "../src/adapter.js";
import type {
  WhatsAppBackend,
  WhatsAppInboundEvent,
  WhatsAppOutboundMessage,
  WhatsAppSendResult,
  WhatsAppStatusReceipt,
} from "../src/backend-types.js";

class FakeBackend implements WhatsAppBackend {
  readonly kind = "cloud" as const;
  connectCalls = 0;
  disconnectCalls = 0;
  /** Lets a test drive the refusal path — a connect that fails must stay retryable. */
  connectResult = true;
  sends: WhatsAppOutboundMessage[] = [];
  sendResults: WhatsAppSendResult[] = [];
  inboundHandler?: (e: WhatsAppInboundEvent) => Promise<void>;
  statusHandler?: (r: WhatsAppStatusReceipt) => Promise<void>;

  async connect(): Promise<boolean> {
    this.connectCalls += 1;
    return this.connectResult;
  }
  async disconnect(): Promise<void> {
    this.disconnectCalls += 1;
  }
  async send(message: WhatsAppOutboundMessage): Promise<WhatsAppSendResult> {
    this.sends.push(message);
    return (
      this.sendResults.shift() ?? {
        ok: true,
        wamid: `wamid.${this.sends.length}`,
      }
    );
  }
  onInbound(handler: (e: WhatsAppInboundEvent) => Promise<void>): () => void {
    this.inboundHandler = handler;
    return () => {
      this.inboundHandler = undefined;
    };
  }
  onStatusReceipt(handler: (r: WhatsAppStatusReceipt) => Promise<void>): () => void {
    this.statusHandler = handler;
    return () => {
      this.statusHandler = undefined;
    };
  }
}

function makeInbound(overrides: Partial<WhatsAppInboundEvent> = {}): WhatsAppInboundEvent {
  return {
    wamid: "wamid.x",
    fromPhone: "5511888888888",
    phoneNumberId: "1234567890",
    contactName: "Test User",
    conversationType: "dm",
    channelId: "5511888888888",
    text: "hi",
    receivedAt: Date.now(),
    backend: "cloud",
    raw: {},
    ...overrides,
  };
}

describe("WhatsAppAdapter — Base contract", () => {
  it("test_adapter_is_base_platform_adapter", () => {
    const adapter = new WhatsAppAdapter(new FakeBackend());
    expect(adapter).toBeInstanceOf(BasePlatformAdapter);
  });

  it("test_adapter_platform_is_whatsapp", () => {
    const adapter = new WhatsAppAdapter(new FakeBackend());
    expect(adapter.platform).toBe("whatsapp");
  });

  it("test_adapter_connect_idempotent", async () => {
    // This assertion used to read `toBe(2)` under a name promising idempotence,
    // with a trailing comment claiming "both calls return true successfully" that
    // nothing asserted. It encoded a MISSING guard as the contract: WhatsApp was
    // the only adapter without one, so a double connect() opened a second live
    // session, and the test that should have caught it required the second
    // session in order to pass. Teams, SMS and Slack all assert exactly once.
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend);
    const first = await adapter.connect();
    const second = await adapter.connect();
    expect(backend.connectCalls).toBe(1);
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it("reconnects after an explicit disconnect", async () => {
    // The guard must be a guard, not a latch: disconnect() has to clear it or a
    // reconnect silently no-ops and the bot goes deaf with no error anywhere.
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend);
    await adapter.connect();
    await adapter.disconnect();
    await adapter.connect();
    expect(backend.connectCalls).toBe(2);
  });

  it("does not latch as connected when the backend refuses", async () => {
    // A failed connect must stay retryable. Latching on a false return would
    // make the first network blip permanent.
    const backend = new FakeBackend();
    backend.connectResult = false;
    const adapter = new WhatsAppAdapter(backend);
    expect(await adapter.connect()).toBe(false);
    expect(await adapter.connect()).toBe(false);
    expect(backend.connectCalls).toBe(2);
  });
});

describe("WhatsAppAdapter — onInbound", () => {
  it("test_adapter_oninbound_replaces (EC-H)", async () => {
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend, { botPhoneId: "1234567890" });
    const h1 = vi.fn(async () => {});
    const h2 = vi.fn(async () => {});
    adapter.onInbound(h1);
    adapter.onInbound(h2); // EC-H: replaces h1
    await backend.inboundHandler!(makeInbound());
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("normalizes inbound to WhatsAppMessageEvent shape", async () => {
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend);
    const handler = vi.fn(async () => {});
    adapter.onInbound(handler);
    await backend.inboundHandler!(makeInbound({ wamid: "wamid.42", text: "hello" }));
    const firstCall = handler.mock.calls[0];
    expect(firstCall).toBeDefined();
    const event = (firstCall as unknown[])[0] as {
      platform: string;
      id: string;
      text: string;
      whatsapp: { backend: string };
    };
    expect(event.platform).toBe("whatsapp");
    expect(event.id).toBe("wamid.42");
    expect(event.text).toBe("hello");
    expect(event.whatsapp.backend).toBe("cloud");
  });
});

describe("WhatsAppAdapter — group mention filter (D309 + EC-7)", () => {
  it("test_adapter_group_mention_default_filters — group msg without mention is dropped", async () => {
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend, { botPhoneId: "5511999999999" });
    const handler = vi.fn(async () => {});
    adapter.onInbound(handler);
    await backend.inboundHandler!(
      makeInbound({ conversationType: "group", channelId: "g1", text: "hey team!" }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("test_adapter_group_mention_normalizes_formats (EC-7)", async () => {
    const botPhoneId = "5511999999999";
    const variants = [
      "@5511999999999 hi",
      "@+5511999999999 hi",
      "hey 55 11 99999-9999 you around?", // digits in order, with separators
      "+55 (11) 99999-9999 yo", // E.164 with parens + dash + plus
    ];
    for (const text of variants) {
      const backend = new FakeBackend();
      const adapter = new WhatsAppAdapter(backend, { botPhoneId });
      const handler = vi.fn(async () => {});
      adapter.onInbound(handler);
      await backend.inboundHandler!(
        makeInbound({ conversationType: "group", channelId: "g1", text }),
      );
      // Each variant when normalized to digits-only includes "5511999999999".
      expect(handler, `variant: ${text}`).toHaveBeenCalledTimes(1);
    }
  });

  it("requireMention=false lets every group message through", async () => {
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend, { botPhoneId: "5511999", requireMention: false });
    const handler = vi.fn(async () => {});
    adapter.onInbound(handler);
    await backend.inboundHandler!(
      makeInbound({ conversationType: "group", channelId: "g1", text: "hey team!" }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("DM is never filtered", async () => {
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend, { botPhoneId: "5511999" });
    const handler = vi.fn(async () => {});
    adapter.onInbound(handler);
    await backend.inboundHandler!(makeInbound({ conversationType: "dm", text: "plain dm" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  /**
   * The four format variants above are all POSITIVE. With no negative case, the
   * only thing constraining the matcher was "must accept these", which an
   * `includes("5511999999999")` over the whole message trivially satisfies —
   * and that is what shipped. Collapsing the entire text to digits let unrelated
   * numbers scattered across a sentence concatenate into the bot's number, so
   * ordinary group chatter about an order woke the bot on every message.
   */
  describe("group mention filter — negative cases", () => {
    it.each([
      ["digits from separate words must not concatenate", "order 55 arrived 11, ref 99999-9999 ok"],
      ["digits scattered across a sentence", "room 5 and 5 have 1 1 999 999 999 9"],
      ["a different number entirely", "@5511888888888 can you look?"],
      ["a prefix of the bot number only", "call 5511 later"],
      ["no digits at all", "does anyone know what happened?"],
    ])("drops a group message when %s", async (_label, text) => {
      const backend = new FakeBackend();
      const adapter = new WhatsAppAdapter(backend, { botPhoneId: "5511999999999" });
      const handler = vi.fn(async () => {});
      adapter.onInbound(handler);
      await backend.inboundHandler!(
        makeInbound({ conversationType: "group", channelId: "g1", text }),
      );
      expect(handler, `text: ${text}`).not.toHaveBeenCalled();
    });

    it("drops silently when botPhoneId is missing, rather than answering everything", async () => {
      // The misconfiguration branch had no test at all: every no-botPhoneId test
      // used a DM, which never reaches the filter. Inverting this branch to
      // "let everything through" would have been invisible.
      const backend = new FakeBackend();
      const adapter = new WhatsAppAdapter(backend, {});
      const handler = vi.fn(async () => {});
      adapter.onInbound(handler);
      await backend.inboundHandler!(
        makeInbound({ conversationType: "group", channelId: "g1", text: "@5511999999999 hi" }),
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe("WhatsAppAdapter — sendMessage", () => {
  it("test_adapter_send_with_empty_text_returns_error", async () => {
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend);
    const r = await adapter.sendMessage({
      channel: { id: "5511888", type: "dm" },
      text: "",
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("empty_text");
    expect(backend.sends).toHaveLength(0);
  });

  it("short message → 1 send", async () => {
    const backend = new FakeBackend();
    const adapter = new WhatsAppAdapter(backend);
    const r = await adapter.sendMessage({
      channel: { id: "5511888", type: "dm" },
      text: "hello",
    });
    expect(r.ok).toBe(true);
    expect(backend.sends).toHaveLength(1);
  });

  it("send error stops remaining parts (T4.3 + EC-8)", async () => {
    const backend = new FakeBackend();
    // First send fails.
    backend.sendResults.push({ ok: false, error: { code: "rate_limit", message: "slow" } });
    const adapter = new WhatsAppAdapter(backend);
    const text = `${"a".repeat(4096)}\n\n${"b".repeat(4096)}`;
    const r = await adapter.sendMessage({ channel: { id: "5511", type: "dm" }, text });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("rate_limit");
    expect(backend.sends).toHaveLength(1);
  });
});

describe("digitsOnly normalizer (EC-7)", () => {
  it("strips +", () => expect(digitsOnly("+5511999")).toBe("5511999"));
  it("strips dashes", () => expect(digitsOnly("99999-9999")).toBe("999999999"));
  it("strips parens + space", () => expect(digitsOnly("(11) 99999-9999")).toBe("11999999999"));
  it("strips letters", () => expect(digitsOnly("@5511hi")).toBe("5511"));
});
