/**
 * The gateway END TO END — the only suite here that deserves the name.
 *
 * Every other suite in this package is an integration test: one adapter against
 * one real API, proving the platform still serves the contract we coded against.
 * None of them imports `@theokit/gateway`, so until this file existed the core
 * had no live coverage at all (issue #20) — `GatewayRunner`, the hook chain and
 * `ctx.reply()` were proven only against fakes.
 *
 * This drives the flow a CONSUMER actually builds:
 *
 *   a real person sends a message
 *     -> the platform delivers it
 *     -> the adapter normalises it
 *     -> GatewayRunner runs the hook chain
 *     -> the handler replies through ctx.reply()
 *     -> the reply lands back on the platform
 *
 * Matrix is the host because it needs no credential from anyone: `pnpm
 * matrix:up` boots Continuwuity in Docker with a bot, a probe account and a
 * room. So this suite runs anywhere the other Docker-backed ones do, including
 * CI, and it costs nothing.
 *
 * The probe account is what makes it real. A bot cannot drive its own inbound —
 * every platform in this package drops messages it sent itself, which is the
 * lesson Telegram, Slack and Email each taught separately. The second identity
 * is not a convenience here; it is the only way the flow can be observed.
 */

import type { MessageEvent as GatewayMessageEvent } from "@theokit/gateway";
import { type GatewayContext, type GatewayHook, GatewayRunner } from "@theokit/gateway";
import { MatrixAdapter } from "@theokit/gateway-matrix";
import { expect, it } from "vitest";

import { required, runMarker } from "../src/credentials.js";
import { describeLive, waitFor } from "../src/harness.js";
import { platformById } from "../src/platforms.js";

const MATRIX = platformById("matrix");

function makeAdapter(): MatrixAdapter {
  return new MatrixAdapter({
    homeserverUrl: required("MATRIX_HOMESERVER_URL"),
    accessToken: required("MATRIX_ACCESS_TOKEN"),
    userId: required("MATRIX_USER_ID"),
    // The room already holds fixture traffic from bootstrap and from the
    // sibling suite. Without a narrow window the runner would answer all of it
    // on start, which is noise here and a loop in production.
    freshnessWindowMs: 60_000,
  });
}

/** Post as the probe — an identity that is NOT the bot. */
async function postAsProbe(roomId: string, body: string): Promise<void> {
  const token = required("MATRIX_TEST_SENDER_TOKEN");
  const url = `${required("MATRIX_HOMESERVER_URL")}/_matrix/client/v3/rooms/${encodeURIComponent(
    roomId,
  )}/send/m.room.message/${encodeURIComponent(`e2e-${Date.now()}-${Math.random()}`)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ msgtype: "m.text", body }),
  });
  if (!res.ok) throw new Error(`probe post failed: ${res.status}`);
}

/** Read the room back as the probe, so the assertion sees what a USER sees. */
async function roomBodiesAsProbe(roomId: string): Promise<string[]> {
  const token = required("MATRIX_TEST_SENDER_TOKEN");
  const url = `${required("MATRIX_HOMESERVER_URL")}/_matrix/client/v3/rooms/${encodeURIComponent(
    roomId,
  )}/messages?dir=b&limit=40`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const body = (await res.json()) as { chunk?: Array<{ content?: { body?: string } }> };
  return (body.chunk ?? []).map((e) => e.content?.body ?? "");
}

describeLive(MATRIX, "gateway end to end", () => {
  it("answers a real message through the runner, and the reply lands in the room", async () => {
    // THE test issue #20 asked for. Everything below the handler is real: a real
    // homeserver, a real second account, the real adapter, and the real runner.
    const roomId = required("MATRIX_TEST_ROOM_ID");
    const marker = runMarker();
    const seenByHook: string[] = [];

    const auditHook: GatewayHook = {
      name: "audit",
      async pre_inbound({ event }) {
        seenByHook.push(event.text);
        return { block: false };
      },
    };

    const runner = new GatewayRunner({
      adapters: [makeAdapter()],
      hooks: [auditHook],
      handler: async (event: GatewayMessageEvent, ctx: GatewayContext) => {
        if (!event.text.includes(marker)) return;
        await ctx.reply(`${marker} answered`);
      },
    });

    try {
      await runner.start();
      await postAsProbe(roomId, `${marker} ping`);

      // The hook saw it: proves the chain ran, not merely that a message arrived.
      await waitFor(() => seenByHook.find((t) => t.includes(marker)), {
        timeoutMs: 60_000,
        intervalMs: 1_000,
        label: `the hook chain to observe ${marker}`,
      });

      // The reply is in the room, read back as the PROBE rather than trusted
      // from ctx.reply()'s return value. A send that reports success and does
      // not arrive is exactly the LINE defect this package was built to catch.
      await waitFor(
        async () => (await roomBodiesAsProbe(roomId)).find((b) => b === `${marker} answered`),
        { timeoutMs: 60_000, intervalMs: 2_000, label: `the reply to ${marker} in the room` },
      );
    } finally {
      await runner.stop();
    }
  }, 180_000);

  it("lets a blocking hook stop the handler, and says so in the room", async () => {
    // The hook chain's whole purpose: refuse a message before the handler runs.
    // Unit tests prove the decision; only this proves the refusal reaches the
    // person who wrote in, over a real transport.
    const roomId = required("MATRIX_TEST_ROOM_ID");
    const marker = runMarker();
    let handlerRan = false;

    const denyHook: GatewayHook = {
      name: "deny",
      async pre_inbound({ event }) {
        if (!event.text.includes(marker)) return { block: false };
        return { block: true, message: `${marker} blocked by policy` };
      },
    };

    const runner = new GatewayRunner({
      adapters: [makeAdapter()],
      hooks: [denyHook],
      handler: async (event: GatewayMessageEvent) => {
        // Guarded by marker, and the guard is the test. Without it any traffic
        // in the room sets this flag — including the previous test's, seconds
        // earlier and well inside the freshness window — and the assertion then
        // reports a blocking-hook defect that is really a fixture leaking in.
        // The first draft had no guard and failed exactly that way.
        if (event.text.includes(marker)) handlerRan = true;
      },
    });

    try {
      await runner.start();
      await postAsProbe(roomId, `${marker} should be blocked`);

      await waitFor(
        async () =>
          (await roomBodiesAsProbe(roomId)).find((b) => b === `${marker} blocked by policy`),
        { timeoutMs: 60_000, intervalMs: 2_000, label: `the block notice for ${marker}` },
      );
      expect(handlerRan, "the handler ran despite a blocking hook").toBe(false);
    } finally {
      await runner.stop();
    }
  }, 180_000);
});
