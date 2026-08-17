/**
 * Regenerates `.env.example` from the platform registry.
 *
 * The example file and the registry drift the moment they are maintained by
 * hand, and a stale example is worse than none: it tells someone to create a
 * credential the code no longer reads, or omits one it does. Generating it means
 * they cannot disagree.
 *
 * Run: pnpm --filter @theokit/gateway-e2e env:example
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { PLATFORMS } from "../src/platforms.js";

const lines: string[] = [
  "# Live end-to-end credentials — GENERATED, do not edit by hand.",
  "# Regenerate: pnpm --filter @theokit/gateway-e2e env:example",
  "#",
  "# Copy to `e2e/.env` and fill in what you have. Missing platforms SKIP with a",
  "# named reason; they never fail and never run against a placeholder.",
  "#",
  "# Every target below must point at a THROWAWAY chat, channel, room or number.",
  "# These tests send real messages.",
  "",
  "# Master switch. Without it every live suite skips, so a stray `pnpm e2e`",
  "# cannot spend money or post into a chat by accident.",
  "E2E_LIVE=0",
  "",
];

for (const spec of PLATFORMS) {
  lines.push(`# ${"=".repeat(72)}`);
  lines.push(`# ${spec.label}  —  ${spec.pkg}`);
  lines.push(
    `# transport: ${spec.transport}${
      spec.transport === "webhook"
        ? " (inbound needs a public HTTPS URL; outbound and auth do not)"
        : " (full round trip runs anywhere, including CI)"
    }`,
  );
  if (spec.caveat !== undefined) lines.push(`# NOTE: ${spec.caveat}`);
  lines.push(`# ${"=".repeat(72)}`);
  for (const cred of [...spec.credentials, ...spec.target]) {
    lines.push(`# ${cred.what}`);
    lines.push(`#   where: ${cred.where}`);
    lines.push(`${cred.name}=`);
  }
  lines.push("");
}

lines.push("# Optional — a second Telegram bot, so the inbound round trip has a sender.");
lines.push("# A bot cannot see its own messages, and EC-K drops messages from other bots,");
lines.push("# so without this the inbound suite has nothing to receive.");
lines.push("TELEGRAM_TEST_SENDER_TOKEN=");
lines.push("");
lines.push("# Optional — public HTTPS URL reaching this process (ngrok, cloudflared).");
lines.push("# Unlocks the inbound suites for the webhook platforms.");
lines.push("E2E_PUBLIC_URL=");
lines.push("");

const target = join(import.meta.dirname, "..", ".env.example");
writeFileSync(target, lines.join("\n"));
process.stdout.write(`wrote ${target}\n`);
