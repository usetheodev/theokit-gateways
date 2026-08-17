/**
 * Provisions `TELEGRAM_TEST_CHAT_ID` with no human in the loop.
 *
 * The chat id is the one thing a bot token cannot tell you: Telegram never lets
 * a bot enumerate its chats, and never lets it speak into a chat that has not
 * spoken to it first. Both rules exist to stop bots cold-messaging people, and
 * neither has an API-side workaround.
 *
 * What DOES have one is the identity doing the asking. A user account can
 * create a group, add the bot to it, and post — so with the session string
 * minted by `session:telegram`, this script builds the whole test fixture and
 * writes its id into `e2e/.env`. From then on nothing here needs a person.
 *
 * Run: pnpm --filter @theokit/gateway-e2e bootstrap:telegram
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

import { optional, required } from "../src/credentials.js";

const ENV_PATH = join(import.meta.dirname, "..", ".env");

/** Insert or replace one `KEY=value` line, leaving every other line untouched. */
function upsertEnv(key: string, value: string): void {
  let text = "";
  try {
    text = readFileSync(ENV_PATH, "utf8");
  } catch {
    // First write; the file is created below.
  }
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.trimStart().startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
    lines.splice(lines.length - 1, 0, `${key}=${value}`);
  }
  writeFileSync(ENV_PATH, lines.join("\n"));
}

const session = optional("TELEGRAM_TEST_SESSION");
if (session === undefined) {
  process.stderr.write(
    [
      "TELEGRAM_TEST_SESSION is not set.",
      "",
      "It is the one credential that needs a person, and only once: Telegram",
      "authenticates a user with a code sent to their phone. Mint it with",
      "",
      "  pnpm --filter @theokit/gateway-e2e session:telegram",
      "",
      "then run this again. Everything after that is unattended.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const token = required("TELEGRAM_BOT_TOKEN");
const me = (await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json()) as {
  ok: boolean;
  result?: { username: string };
};
if (me.ok !== true || me.result === undefined) {
  process.stderr.write("TELEGRAM_BOT_TOKEN was rejected by Telegram\n");
  process.exit(1);
}
const botUsername = me.result.username;

const client = new TelegramClient(
  new StringSession(session),
  Number(required("TELEGRAM_API_ID")),
  required("TELEGRAM_API_HASH"),
  { connectionRetries: 3 },
);

await client.connect();

const title = `theokit-e2e ${new Date().toISOString().slice(0, 10)}`;
process.stdout.write(`creating group "${title}" with @${botUsername}…\n`);

const created = await client.invoke(new Api.messages.CreateChat({ users: [botUsername], title }));

// The created chat surfaces in the update payload rather than as a return value.
const chats = (created as unknown as { updates?: { chats?: Array<{ id: unknown }> } }).updates
  ?.chats;
const rawId = chats?.[0]?.id;
if (rawId === undefined) {
  process.stderr.write(
    "group was created but Telegram did not return its id — run discover:telegram\n",
  );
  process.exit(1);
}

// Bot API ids for basic groups are the MTProto id, negated.
const chatId = `-${String(rawId)}`;

// One message so the chat has traffic; a bot may only speak into a chat with history.
await client.sendMessage(chatId, { message: "theokit e2e fixture — created for live tests" });
await client.disconnect();

upsertEnv("TELEGRAM_TEST_CHAT_ID", chatId);

process.stdout.write(
  [
    "",
    `TELEGRAM_TEST_CHAT_ID=${chatId}`,
    "",
    "Written to e2e/.env. Add the same value as a repository secret for CI.",
    "Run the live suite with: pnpm e2e",
    "",
  ].join("\n"),
);
