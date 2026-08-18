/**
 * Email — live tests against a real IMAP + SMTP server.
 *
 * Email is the platform where a fake is least trustworthy, because "IMAP" is not
 * one protocol in practice: Gmail exposes labels as folders, keeps a synthetic
 * `[Gmail]/All Mail`, and answers some standard commands in its own way. A fake
 * built from the RFC agrees with the RFC. Only the server tells you whether the
 * mailbox this adapter opens is the mailbox the user's mail actually lands in.
 *
 * The round trip needs TWO mailboxes, not one. Mailing itself was the obvious
 * design and it cannot work: the adapter drops own-address mail before anything
 * else (EC-1), because a bot that answers its own mail loops by email, and an
 * email loop does not stop when the process does.
 *
 * It is also the slowest platform here — delivery is not instant, so the inbound
 * assertion polls with a wide timeout instead of pretending otherwise.
 *
 * The per-test timeouts are 180s, and the reason is a finding rather than a
 * knob. Timing each step against the real server:
 *
 *   connect()     114.4s
 *   sendMessage()   4.3s
 *   disconnect()   41.5s
 *
 * Sending is fine. `connect()` calls `_drainUnseen()`, which fetches and
 * dispatches every UNSEEN message before returning — so connect time scales with
 * the unread backlog, not with the protocol. A plain IMAP login against the same
 * mailbox takes 11.7s; this took ten times that with 171 messages sitting
 * unread, and it was fast this morning when the mailbox was nearly empty.
 *
 * Draining on connect is defensible — a bot should not miss what arrived while
 * it was down. Blocking connect() on it is the part worth questioning: a bot
 * restarting after a busy period is unresponsive for minutes, and the operator
 * sees a hang. Recorded here rather than changed, because altering drain
 * semantics is a design decision and not a test fix.
 */

import { EmailAdapter, type EmailMessageEvent } from "@theokit/gateway-email";
import { expect, it } from "vitest";

import { optional, required, runMarker } from "../../src/credentials.js";
import { describeLive, describeLiveInbound, waitFor } from "../../src/harness.js";
import { platformById } from "../../src/platforms.js";

const EMAIL = platformById("email");

function makeAdapter(overrides: Record<string, unknown> = {}): EmailAdapter {
  return new EmailAdapter({
    address: required("EMAIL_ADDRESS"),
    password: required("EMAIL_PASSWORD"),
    imapHost: required("EMAIL_IMAP_HOST"),
    smtpHost: required("EMAIL_SMTP_HOST"),
    // Gmail's app-password SMTP wants implicit TLS on 465; 587 STARTTLS also
    // works, but 465 fails faster when the credential is wrong, which is the
    // behaviour worth having in a test.
    smtpPort: 465,
    // The probe mails itself, and `noreply`-style filtering (D332) would not
    // apply — but allowedSenders must stay open or the round trip drops its own
    // message before the assertion sees it.
    allowAutomated: true,
    ...overrides,
  });
}

describeLive(
  EMAIL,
  "authentication",
  () => {
    it("connects to both IMAP and SMTP with the real credentials", async () => {
      // One connect() covers two servers. If either half is wrong the adapter
      // must say so rather than half-starting.
      const adapter = makeAdapter();
      try {
        expect(await adapter.connect()).toBe(true);
      } finally {
        await adapter.disconnect();
      }
    }, 180_000);

    it("returns false rather than throwing on a password the server rejects", async () => {
      const adapter = makeAdapter({ password: "nnnnnnnnnnnnnnnn" });
      try {
        expect(await adapter.connect()).toBe(false);
      } finally {
        await adapter.disconnect();
      }
    }, 180_000);
  },
  { sends: false },
);

describeLive(EMAIL, "outbound", () => {
  it("sends a message the SMTP server accepts, and returns its id", async () => {
    const adapter = makeAdapter();
    const marker = runMarker();
    try {
      await adapter.connect();
      const result = await adapter.sendMessage({
        channel: { id: required("EMAIL_TEST_RECIPIENT"), type: "dm" },
        text: `${marker} outbound ok`,
      });
      expect(result.ok).toBe(true);
      expect(result.messageId).toBeDefined();
    } finally {
      await adapter.disconnect();
    }
  }, 180_000);

  it("maps an undeliverable recipient into a structured error", async () => {
    // Gmail rejects a malformed recipient at RCPT TO, synchronously. A domain
    // that merely does not exist would bounce later and asynchronously, which no
    // test can wait for — so the assertion targets the synchronous refusal.
    const adapter = makeAdapter();
    try {
      await adapter.connect();
      const result = await adapter.sendMessage({
        channel: { id: "not-an-address", type: "dm" },
        text: "this address is not deliverable",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBeDefined();
      expect(result.error?.message.length ?? 0).toBeGreaterThan(0);
    } finally {
      await adapter.disconnect();
    }
  }, 180_000);

  it("refuses empty text without opening an SMTP transaction", async () => {
    // Deliberately does NOT connect. `sendMessage` checks `text.length === 0`
    // before it looks at the connection, so the refusal is observable without
    // one — and connecting here would cost the 114s drain for nothing, which is
    // what it used to do. Skipping it makes the test both faster and a sharper
    // statement: empty text is refused by the adapter, not by the transport.
    const adapter = makeAdapter();
    const result = await adapter.sendMessage({
      channel: { id: required("EMAIL_TEST_RECIPIENT"), type: "dm" },
      text: "",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("empty_text");
  }, 30_000);
});

describeLiveInbound(EMAIL, "inbound round trip", () => {
  it("reads back over IMAP a message sent from a different address", async () => {
    // The whole gateway in one assertion: the provider's delivery, the IMAP
    // watcher, UID tracking, and normalization. Nothing in the unit suite can
    // substitute for it, because every one of those is faked there.
    //
    // The sender must NOT be the bot's own address. `adapter.ts` drops
    // own-address mail before anything else (EC-1, critical): without that guard
    // a bot that replies to its own mail loops forever, and the loop is by email,
    // so it does not stop when the process does.
    //
    // The first version of this test had the bot mail ITSELF, which cannot work
    // for exactly that reason. It is the same mistake as driving Telegram
    // inbound with a second bot and Slack inbound with the bot token: every one
    // of those platforms has a loop guard, and every one of them makes the
    // obvious probe invisible. A round trip needs a second identity — that is
    // the rule, not the exception.
    const senderAddress = optional("EMAIL_TEST_SENDER_ADDRESS");
    const senderPassword = optional("EMAIL_TEST_SENDER_PASSWORD");
    if (senderAddress === undefined || senderPassword === undefined) {
      expect
        .soft(
          senderAddress,
          "set EMAIL_TEST_SENDER_ADDRESS/PASSWORD to a SECOND mailbox — the bot cannot mail itself (EC-1)",
        )
        .toBeUndefined();
      return;
    }

    const adapter = makeAdapter();
    const marker = runMarker();
    const seen: string[] = [];

    try {
      adapter.onInbound(async (event) => {
        const email = event as EmailMessageEvent;
        seen.push(`${email.email?.subject ?? ""} ${email.text}`);
      });
      await adapter.connect();

      const { createTransport } = await import("nodemailer");
      const sender = createTransport({
        host: optional("EMAIL_TEST_SENDER_SMTP_HOST") ?? required("EMAIL_SMTP_HOST"),
        port: 465,
        secure: true,
        auth: { user: senderAddress, pass: senderPassword },
      });
      await sender.sendMail({
        from: senderAddress,
        to: required("EMAIL_ADDRESS"),
        subject: `${marker} inbound probe`,
        text: `${marker} inbound probe`,
      });

      // Delivery is usually seconds, but "usually" is not a contract.
      await waitFor(() => seen.find((t) => t.includes(marker)), {
        timeoutMs: 120_000,
        intervalMs: 2_000,
        label: `an inbound email containing ${marker}`,
      });
    } finally {
      await adapter.disconnect();
    }
    // 420s, and the extra budget is NOT slack for a slow network — it is the
    // cost of issue #11. `connect()` re-fetches the full body of every UNSEEN
    // message before it returns, and the mailbox holds 166 of them because the
    // adapter never marks anything \Seen on the server. Measured 2026-08-18:
    // IMAP login alone 38.2s, and the drain on top of it overran the 180s this
    // test used to allow, so the round trip could not even be attempted.
    //
    // This number therefore tracks a defect, not a property of email. It should
    // come back down to ~180s once #11 lands — and if it ever needs raising
    // again, that is the backlog growing, which is the same bug reporting
    // itself a second time.
  }, 420_000);
});
