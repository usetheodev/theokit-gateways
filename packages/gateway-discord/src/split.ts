/**
 * Discord's 2000-char per-message hard limit. Split agent responses on safe
 * boundaries before sending (T6.1). Extracted verbatim from `adapter.ts`
 * (roadmap M0, step 4) so it sits beside its sibling adapters' `split.ts` and
 * gains a pin test; behavior is unchanged.
 *
 * Break preference: `\n\n` → `\n` → soft boundary. No surrogate guard and
 * newline-only leading strip (Telegram-family shape, minus markdown balancing).
 *
 * @internal
 */

const DISCORD_MAX_MESSAGE = 2000;
const SAFE_DISCORD_CHUNK = 1900;

export function splitForDiscord(text: string): string[] {
  if (text.length <= DISCORD_MAX_MESSAGE) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= SAFE_DISCORD_CHUNK) {
      parts.push(remaining);
      break;
    }
    let boundary = remaining.lastIndexOf("\n\n", SAFE_DISCORD_CHUNK);
    if (boundary < SAFE_DISCORD_CHUNK / 2) {
      boundary = remaining.lastIndexOf("\n", SAFE_DISCORD_CHUNK);
    }
    if (boundary < SAFE_DISCORD_CHUNK / 2) boundary = SAFE_DISCORD_CHUNK;
    parts.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary).replace(/^\n+/, "");
  }
  return parts;
}
