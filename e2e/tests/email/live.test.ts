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
 * Every message carries a run marker. The suite does NOT delete what it sends:
 * the target is a dedicated mailbox, and an IMAP delete that raced the watcher
 * would make failures harder to read than the litter is worth. Search
 * `theokit-e2e` to find it all.
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
    }, 60_000);

    it("returns false rather than throwing on a password the server rejects", async () => {
      const adapter = makeAdapter({ password: "nnnnnnnnnnnnnnnn" });
      try {
        expect(await adapter.connect()).toBe(false);
      } finally {
        await adapter.disconnect();
      }
    }, 60_000);
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
  }, 60_000);

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
  }, 60_000);

  it("refuses empty text without opening an SMTP transaction", async () => {
    const adapter = makeAdapter();
    try {
      await adapter.connect();
      const result = await adapter.sendMessage({
        channel: { id: required("EMAIL_TEST_RECIPIENT"), type: "dm" },
        text: "",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("empty_text");
    } finally {
      await adapter.disconnect();
    }
  }, 60_000);
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
  }, 180_000);
});
