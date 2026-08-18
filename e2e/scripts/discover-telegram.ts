/**
 * Prints the chat ids the Telegram bot can currently see.
 *
 * `TELEGRAM_TEST_CHAT_ID` cannot be derived from the token: Telegram only
 * reveals a chat once someone has spoken in it. Send one message to the bot (or
 * to the group it is in) and run this.
 *
 * Run: pnpm --filter @theokit/gateway-e2e discover:telegram
 */

import { required } from "../src/credentials.js";

interface TelegramChat {
  readonly id: number;
  readonly type: string;
  readonly title?: string;
  readonly username?: string;
  readonly first_name?: string;
}

interface TelegramUpdate {
  readonly message?: { readonly chat?: TelegramChat };
  readonly edited_message?: { readonly chat?: TelegramChat };
  readonly channel_post?: { readonly chat?: TelegramChat };
}

interface GetMeResponse {
  readonly ok: boolean;
  readonly result?: { readonly username: string; readonly id: number };
}

interface GetUpdatesResponse {
  readonly ok: boolean;
  readonly result?: readonly TelegramUpdate[];
}

const token = required("TELEGRAM_BOT_TOKEN");

const me = (await (
  await fetch(`https://api.telegram.org/bot${token}/getMe`)
).json()) as GetMeResponse;
if (me.ok !== true || me.result === undefined) {
  process.stderr.write("token rejected by Telegram\n");
  process.exit(1);
}
process.stdout.write(`bot: @${me.result.username} (id ${me.result.id})\n`);

const updates = (await (
  await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`)
).json()) as GetUpdatesResponse;

const chats = new Map<number, string>();
for (const update of updates.result ?? []) {
  const chat = (update.message ?? update.edited_message ?? update.channel_post)?.chat;
  if (chat !== undefined) {
    const label = chat.title ?? chat.username ?? chat.first_name ?? "";
    chats.set(chat.id, `${chat.type} — ${label}`);
  }
}

if (chats.size === 0) {
  process.stdout.write(
    "\nNo chats visible yet.\n" +
      "Send the bot one message — DM it, or add it to a throwaway group and post —\n" +
      "then run this again. Telegram only reports a chat after it has traffic.\n",
  );
  process.exit(0);
}

process.stdout.write("\nchats the bot can see:\n");
for (const [id, label] of chats) {
  process.stdout.write(`  TELEGRAM_TEST_CHAT_ID=${id}   # ${label}\n`);
}
