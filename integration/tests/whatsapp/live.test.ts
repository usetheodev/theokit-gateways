/**
 * WhatsApp (Cloud API) — live tests against Meta's Graph API.
 *
 * NEVER EXECUTED. No WhatsApp credentials exist for this project, so every test
 * here skips naming the variable it wants. Read it as a declared gap rather than
 * as coverage; first runs of unexecuted tests find their own bugs.
 *
 * Unlike its siblings the adapter takes a BACKEND rather than credentials, so
 * this constructs `WhatsAppCloudBackend` explicitly. Two consequences worth
 * knowing before someone provisions this: `appSecret` is required by the backend
 * but is not in the registry (it exists for webhook signature verification, which
 * inbound needs and outbound does not), and a Cloud API number can only message
 * someone who messaged it in the last 24 hours unless the message is a template.
 * An outbound test against a cold recipient will fail for policy, not for code.
 *
 * Webhook-based: inbound needs a public HTTPS endpoint, out of scope here for the
 * same reason as LINE.
 */

import { WhatsAppAdapter, WhatsAppCloudBackend } from "@theokit/gateway-whatsapp";
import { expect, it } from "vitest";

import { optional, required, runMarker } from "../../src/credentials.js";
import { describeLive } from "../../src/harness.js";
import { platformById } from "../../src/platforms.js";

const WHATSAPP = platformById("whatsapp");

function makeAdapter(overrides: Record<string, unknown> = {}): WhatsAppAdapter {
  const backend = new WhatsAppCloudBackend({
    accessToken: required("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    // Not in the registry: it verifies webhook signatures, which only inbound
    // uses. Outbound works without it, so an empty string keeps the constructor
    // honest instead of inventing a credential nobody provisioned.
    appSecret: optional("WHATSAPP_APP_SECRET") ?? "",
    ...overrides,
  });
  return new WhatsAppAdapter(backend, { botPhoneId: required("WHATSAPP_PHONE_NUMBER_ID") });
}

describeLive(
  WHATSAPP,
  "authentication",
  () => {
    it("connects with a real access token", async () => {
      const adapter = makeAdapter();
      try {
        expect(await adapter.connect()).toBe(true);
      } finally {
        await adapter.disconnect();
      }
    }, 45_000);

    it("returns false rather than throwing on a token Meta rejects", async () => {
      const adapter = makeAdapter({ accessToken: "definitely-not-a-real-token" });
      try {
        expect(await adapter.connect()).toBe(false);
      } finally {
        await adapter.disconnect();
      }
    }, 45_000);
  },
  { sends: false },
);

describeLive(WHATSAPP, "outbound", () => {
  it("delivers a message to the test recipient", async () => {
    // Expect this to fail on policy rather than code if the recipient has not
    // messaged the number within 24 hours. That is Meta's rule, not a defect.
    const adapter = makeAdapter();
    const marker = runMarker();
    try {
      await adapter.connect();
      const result = await adapter.sendMessage({
        channel: { id: required("WHATSAPP_TEST_RECIPIENT"), type: "dm" },
        text: `${marker} outbound ok`,
      });
      expect(result.ok).toBe(true);
    } finally {
      await adapter.disconnect();
    }
  }, 45_000);

  it("refuses empty text without calling the API", async () => {
    const adapter = makeAdapter();
    const result = await adapter.sendMessage({
      channel: { id: required("WHATSAPP_TEST_RECIPIENT"), type: "dm" },
      text: "",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("empty_text");
  }, 30_000);
});
