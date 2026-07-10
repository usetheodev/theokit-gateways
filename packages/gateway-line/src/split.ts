/**
 * Grapheme-cluster-safe split for LINE outbound text (D411, EC-7).
 *
 * LINE limits text messages to 5000 chars. Thin wrapper over core
 * `chunkByGrapheme` (roadmap M1) — single-sources the `Intl.Segmenter` grapheme
 * walk so emoji, regional indicators, and combining sequences are never severed.
 * Output is byte-identical to the previous implementation (pinned by
 * `tests/split.test.ts`).
 */

import { chunkByGrapheme } from "@theokit/gateway";

export function splitForLine(text: string, limit = 5000): string[] {
  return chunkByGrapheme(text, { limit });
}
