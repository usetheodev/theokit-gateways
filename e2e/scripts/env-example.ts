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

lines.push(`# ${"=".repeat(72)}`);
lines.push("# Unattended inbound for Telegram (optional, but it is what removes the human)");
lines.push(`# ${"=".repeat(72)}`);
lines.push("#");
lines.push("# Telegram's Bot FAQ: \"bots will not be able to see messages from other bots");
lines.push('# regardless of mode". So the inbound sender cannot be a second bot — it has to');
lines.push("# be a USER account, driven over MTProto.");
lines.push("#");
lines.push("# Minting the session is the ONE step that needs a person, exactly once:");
lines.push("#   pnpm --filter @theokit/gateway-e2e session:telegram");
lines.push("# After that, bootstrap:telegram creates the test group, adds the bot and writes");
lines.push("# TELEGRAM_TEST_CHAT_ID here by itself.");
lines.push("#");
lines.push("# Application id/hash — identify the APP, not the account.");
lines.push("#   where: my.telegram.org → API development tools");
lines.push("TELEGRAM_API_ID=");
lines.push("TELEGRAM_API_HASH=");
lines.push("# Session string for a THROWAWAY user account.");
lines.push("# This is full access to that account, not a scoped token. Treat it as a password.");
lines.push("TELEGRAM_TEST_SESSION=");
lines.push("");
lines.push("# Optional — public HTTPS URL reaching this process (ngrok, cloudflared).");
lines.push("# Unlocks the inbound suites for the webhook platforms.");
lines.push("E2E_PUBLIC_URL=");
lines.push("");

const target = join(import.meta.dirname, "..", ".env.example");
writeFileSync(target, lines.join("\n"));
process.stdout.write(`wrote ${target}\n`);
