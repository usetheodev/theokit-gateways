/**
 * `splitForSMS` — grapheme-cluster-safe multipart segmentation (D393, EC-7).
 *
 * Concatenated SMS (UDH) on modern carriers reassemble at the recipient,
 * but each TCP/IP-layer chunk is one billed message. We segment at
 * 1600 chars (default) so the API call doesn't reject and each part is
 * prefixed with `(i/N) ` to allow manual reordering when carriers
 * deliver out of sequence (EC-7).
 *
 * Thin wrapper over core `chunkByGrapheme` (roadmap M1) — single-sources the
 * `Intl.Segmenter` grapheme walk so emoji (🇧🇷) and combining sequences are
 * never severed. The `(i/N) ` prefix (and its reserved width) stays here since
 * it is SMS-specific. Output is byte-identical to the previous implementation
 * (pinned by `tests/split.test.ts`).
 *
 * @internal
 */

import { chunkByGrapheme } from "@theokit/gateway";

const PART_PREFIX_RESERVED = 8; // "(99/99) " worst case

export function splitForSMS(text: string, limit = 1600): string[] {
  const parts = chunkByGrapheme(text, { limit, partLimit: limit - PART_PREFIX_RESERVED });
  if (parts.length <= 1) return parts; // short-circuit / single part: skip prefix
  const total = parts.length;
  return parts.map((p, i) => `(${i + 1}/${total}) ${p}`);
}
