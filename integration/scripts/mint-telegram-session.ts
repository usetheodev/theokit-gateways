/**
 * Mints `TELEGRAM_TEST_SESSION` — a reusable MTProto session string for a USER
 * account, so the inbound round trip can run with nobody watching.
 *
 * Why a user account and not a second bot: Telegram's Bot FAQ is explicit —
 * "bots will not be able to see messages from other bots regardless of mode".
 * A bot posting into the test chat is therefore invisible to the bot under
 * test, so an inbound suite driven by a second bot token can never pass. Only a
 * user identity can put a message where the gateway will see it.
 *
 * This script is the ONE step that needs a human, and it needs one exactly once:
 * Telegram authenticates a user with a code sent to their phone. After that the
 * printed session string is a credential like any other — put it in `integration/.env`
 * and in repository secrets, and every later run is unattended.
 *
 * Run: pnpm --filter @theokit/gateway-integration session:telegram
 *
 * TREAT THE OUTPUT AS A PASSWORD. A session string is full access to that
 * Telegram account — not a scoped token. Use a throwaway account, never a
 * personal one.
 */

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

import { required } from "../src/credentials.js";

// api_id / api_hash identify the APPLICATION, not the account. Create them once
// at my.telegram.org → API development tools.
const apiId = Number(required("TELEGRAM_API_ID"));
const apiHash = required("TELEGRAM_API_HASH");

if (!Number.isInteger(apiId) || apiId <= 0) {
  process.stderr.write("TELEGRAM_API_ID must be the numeric app id from my.telegram.org\n");
  process.exit(1);
}

// Node's own prompt rather than a dependency: three questions asked once do not
// justify a package, and this one is typed.
const rl = createInterface({ input: stdin, output: stdout });

const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 3 });

await client.start({
  phoneNumber: async () => await rl.question("Phone number (E.164, e.g. +5511999999999): "),
  password: async () => await rl.question("Two-step verification password (blank if none): "),
  phoneCode: async () => await rl.question("Login code Telegram just sent: "),
  onError: (err) => {
    process.stderr.write(`${String(err)}\n`);
  },
});

const session = String(client.session.save());
await client.disconnect();
rl.close();

process.stdout.write(
  [
    "",
    "Session minted. Add this to integration/.env and to repository secrets:",
    "",
    `TELEGRAM_TEST_SESSION=${session}`,
    "",
    "This string is full access to that account. Do not commit it, do not paste",
    "it into an issue, and use a throwaway account rather than a personal one.",
    "",
  ].join("\n"),
);
