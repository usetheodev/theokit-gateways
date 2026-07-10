/**
 * Split a long string into ≤8000-char chunks for Teams messages (ADR D322).
 *
 * Thin wrapper over core `chunkText` (roadmap M1). Teams family: fixed 8000
 * window, `\n\n` → `\n` → ` ` boundary preference, UTF-16 surrogate-pair guard,
 * leading-whitespace strip, `trimParts` (EC-8 empty-part filter). Output is
 * byte-identical to the previous implementation (pinned by `tests/split.test.ts`).
 *
 * @internal
 */

import { chunkText } from "@theokit/gateway";

/**
 * Sentinel runtime export — workaround for rollup-plugin-dts deep type-only
 * re-export bug. The marker is INTENTIONALLY orphan: it forces rollup-plugin-dts
 * to keep the module in the bundle so re-exports from `index.ts` resolve.
 *
 * @knipignore
 */
export const __splitMarker: unique symbol = Symbol("split");

const TEAMS_MAX_TEXT = 8000;

export function splitForTeams(text: string): string[] {
  return chunkText(text, {
    limit: TEAMS_MAX_TEXT,
    boundaries: ["\n\n", "\n", " "],
    lastResort: "last-boundary",
    surrogateGuard: true,
    stripLeading: /^\s+/,
    trimParts: true,
  });
}
