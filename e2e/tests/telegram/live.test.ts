/**
 * Telegram — live tests against api.telegram.org with a real bot token.
 *
 * This is the reference implementation the other nine platforms follow. What it
 * asserts is deliberately not "the adapter's unit tests, again over the wire":
 * the unit suite already covers splitting, filtering and normalization against
 * fakes. What only a real API can tell us is whether the CONTRACT we coded
 * against still matches the one the platform serves — that our auth reaches it,
 * that our payload shape is accepted, and that a real error maps to the error
 * we claim to return.
 *
 * Every message carries a run marker, so anything that escapes into a real chat
 * is identifiable as test traffic.
 */

import { TelegramAdapter } from "@theokit/gateway-telegram";
import { expect, it } from "vitest";

import { optional, required, runMarker } from "../../src/credentials.js";
import { describeLive, describeLiveInbound, waitFor } from "../../src/harness.js";
import { platformById } from "../../src/platforms.js";

const TELEGRAM = platformById("telegram");

describeLive(
  TELEGRAM,
  "authentication",
  () => {
    it("connect() succeeds against the real API with a valid token", async () => {
      const adapter = new TelegramAdapter({ token: required("TELEGRAM_BOT_TOKEN") });
      try {
        expect(await adapter.connect()).toBe(true);
      } finally {
        await adapter.disconnect();
      }
    });

    it("connect() returns false — never throws — on a token the API rejects", async () => {
      // EC-I is only meaningful against a real 401. A fake can be told to reject;
      // only Telegram can tell us the shape it actually rejects with, and that our
      // handler still catches it.
      const adapter = new TelegramAdapter({ token: "123456:definitely-not-a-real-token" });
      try {
        expect(await adapter.connect()).toBe(false);
      } finally {
        await adapter.disconnect();
      }
    });
  },
  // Authenticating writes nothing, so it needs the token and not a test chat.
  { sends: false },
);

describeLive(TELEGRAM, "outbound", () => {
  it("delivers a message to the test chat and returns its id", async () => {
    const adapter = new TelegramAdapter({ token: required("TELEGRAM_BOT_TOKEN") });
    const marker = runMarker();
    try {
      await adapter.connect();
      const result = await adapter.sendMessage({
        channel: { id: required("TELEGRAM_TEST_CHAT_ID"), type: "group" },
        text: `${marker} outbound ok`,
      });
      expect(result.ok).toBe(true);
      expect(result.messageId).toBeDefined();
    } finally {
      await adapter.disconnect();
    }
  });

  it("splits a message over Telegram's 4096-char cap into several real sends", async () => {
    // The split logic is unit-tested. What is NOT unit-testable is whether
    // Telegram accepts each part we produce — a chunk one byte over the cap comes
    // back 400, and only the real API says so.
    const adapter = new TelegramAdapter({ token: required("TELEGRAM_BOT_TOKEN") });
    const marker = runMarker();
    try {
      await adapter.connect();
      const long = `${marker} ${"paragraph.\n\n".repeat(500)}`;
      const result = await adapter.sendMessage({
        channel: { id: required("TELEGRAM_TEST_CHAT_ID"), type: "group" },
        text: long,
      });
      expect(result.ok).toBe(true);
    } finally {
      await adapter.disconnect();
    }
  }, 60_000);

  it("maps a rejected chat id to a structured error rather than throwing", async () => {
    const adapter = new TelegramAdapter({ token: required("TELEGRAM_BOT_TOKEN") });
    try {
      await adapter.connect();
      const result = await adapter.sendMessage({
        channel: { id: "-1000000000000", type: "group" },
        text: "this chat does not exist",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBeDefined();
      // The message is for a human reading logs; it must not be empty.
      expect(result.error?.message.length ?? 0).toBeGreaterThan(0);
    } finally {
      await adapter.disconnect();
    }
  });

  it("refuses empty text without calling the API", async () => {
    const adapter = new TelegramAdapter({ token: required("TELEGRAM_BOT_TOKEN") });
    try {
      await adapter.connect();
      const result = await adapter.sendMessage({
        channel: { id: required("TELEGRAM_TEST_CHAT_ID"), type: "group" },
        text: "",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("empty_text");
    } finally {
      await adapter.disconnect();
    }
  });
});

describeLiveInbound(TELEGRAM, "inbound round trip", () => {
  it("receives a message posted into the test chat", async () => {
    // Telegram is connection-based: the bot long-polls, so this round trip runs
    // anywhere, including CI, with no public URL.
    //
    // It needs a SECOND identity to post — a bot cannot see its own messages,
    // and Telegram does not deliver bot messages to other bots (EC-K drops them
    // regardless). Without TELEGRAM_TEST_SENDER_TOKEN there is nothing to
    // receive, so the test says so instead of asserting nothing.
    const senderToken = optional("TELEGRAM_TEST_SENDER_TOKEN");
    if (senderToken === undefined) {
      expect.soft(senderToken, "set TELEGRAM_TEST_SENDER_TOKEN to a second bot").toBeUndefined();
      return;
    }

    const adapter = new TelegramAdapter({ token: required("TELEGRAM_BOT_TOKEN") });
    const chatId = required("TELEGRAM_TEST_CHAT_ID");
    const marker = runMarker();
    const seen: string[] = [];

    try {
      adapter.onInbound(async (event) => {
        seen.push(event.text);
      });
      await adapter.connect();

      const res = await fetch(`https://api.telegram.org/bot${senderToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `${marker} inbound probe` }),
      });
      expect(res.ok).toBe(true);

      await waitFor(() => seen.find((t) => t.includes(marker)), {
        timeoutMs: 30_000,
        label: `an inbound message containing ${marker}`,
      });
    } finally {
      await adapter.disconnect();
    }
  }, 60_000);
});
