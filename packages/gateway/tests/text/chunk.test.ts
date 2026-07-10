/**
 * Golden tests for `chunkText` (roadmap M0, step 2).
 *
 * The strongest guarantee we can give M1 (which migrates 4 adapters onto
 * `chunkText`) is that `chunkText`, configured per family, reproduces the
 * ORIGINAL adapter algorithms byte-for-byte. So this file embeds verbatim
 * copies of the pre-migration `splitForSlack` / `splitForWhatsApp` /
 * `splitForTeams` / `splitForDiscord` implementations as reference oracles and
 * asserts equality across a deterministic corpus. If these pass, the M1
 * wrappers are guaranteed identical output.
 */

import { describe, expect, it } from "vitest";

import { chunkText } from "../../src/text/chunk.js";

// ---------------------------------------------------------------------------
// Reference oracles — verbatim copies of the pre-M1 adapter split functions.
// ---------------------------------------------------------------------------

/** Slack-family cut point (verbatim logic; MAX-parametrized to de-dup the 3 copies). */
function oracleFindCutPointA(remaining: string, max: number): number {
  let cut = remaining.lastIndexOf("\n\n", max);
  if (cut < max * 0.5) cut = remaining.lastIndexOf("\n", max);
  if (cut < max * 0.5) cut = remaining.lastIndexOf(" ", max);
  if (cut <= 0) cut = max;
  if (cut < remaining.length) {
    const code = remaining.charCodeAt(cut);
    if (code >= 0xdc00 && code <= 0xdfff) cut -= 1;
  }
  return cut <= 0 ? max : cut;
}

/** Slack-family loop; `trimParts` reproduces the WhatsApp/Teams end-trim variant. */
function oracleFamilyA(text: string, max: number, trimParts: boolean): string[] {
  if (text.length <= max) {
    if (!trimParts) return [text];
    const single = text.trim();
    return single.length > 0 ? [single] : [];
  }
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    const cut = oracleFindCutPointA(remaining, max);
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^[\s]+/, "");
  }
  if (remaining.length > 0) chunks.push(remaining);
  return trimParts ? chunks.map((p) => p.trim()).filter((p) => p.length > 0) : chunks;
}

const oracleSlack = (text: string): string[] => oracleFamilyA(text, 4000, false);
const oracleWhatsApp = (text: string): string[] => oracleFamilyA(text, 4096, true);
const oracleTeams = (text: string): string[] => oracleFamilyA(text, 8000, true);

function oracleDiscord(text: string): string[] {
  const MAX = 2000;
  const SAFE = 1900;
  if (text.length <= MAX) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= SAFE) {
      parts.push(remaining);
      break;
    }
    let boundary = remaining.lastIndexOf("\n\n", SAFE);
    if (boundary < SAFE / 2) boundary = remaining.lastIndexOf("\n", SAFE);
    if (boundary < SAFE / 2) boundary = SAFE;
    parts.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary).replace(/^\n+/, "");
  }
  return parts;
}

// ---------------------------------------------------------------------------
// chunkText configured per family — must match the oracle exactly.
// ---------------------------------------------------------------------------

const slackViaCore = (t: string) =>
  chunkText(t, {
    limit: 4000,
    boundaries: ["\n\n", "\n", " "],
    lastResort: "last-boundary",
    surrogateGuard: true,
    stripLeading: /^\s+/,
  });

const whatsappViaCore = (t: string) =>
  chunkText(t, {
    limit: 4096,
    boundaries: ["\n\n", "\n", " "],
    lastResort: "last-boundary",
    surrogateGuard: true,
    stripLeading: /^\s+/,
    trimParts: true,
  });

const teamsViaCore = (t: string) =>
  chunkText(t, {
    limit: 8000,
    boundaries: ["\n\n", "\n", " "],
    lastResort: "last-boundary",
    surrogateGuard: true,
    stripLeading: /^\s+/,
    trimParts: true,
  });

const discordViaCore = (t: string) =>
  chunkText(t, {
    limit: 2000,
    safeLimit: 1900,
    boundaries: ["\n\n", "\n"],
    lastResort: "window",
    stripLeading: /^\n+/,
  });

// ---------------------------------------------------------------------------
// Deterministic corpus generator (no Math.random — reproducible).
// ---------------------------------------------------------------------------

function makeCorpus(): string[] {
  const corpus: string[] = ["", "short", "   leading and trailing   ", "line1\nline2\n\npara2"];
  // Long strings with paragraph/line/space structure around each family's window.
  const word = "lorem ipsum dolor sit amet ";
  const para = `${word.repeat(20)}\n\n`;
  for (const size of [
    1899, 1900, 1901, 2000, 2001, 3999, 4000, 4001, 4096, 4097, 8000, 8001, 12000,
  ]) {
    // Space-separated words (exercises " " boundary + tail).
    let spaced = "";
    while (spaced.length < size) spaced += word;
    corpus.push(spaced.slice(0, size));
    // Paragraph-structured (exercises \n\n / \n boundaries).
    let paras = "";
    while (paras.length < size) paras += para;
    corpus.push(paras.slice(0, size));
    // A block with no breakable boundary at all (forces window fallback).
    corpus.push("x".repeat(size));
  }
  // Emoji at the window edge to exercise the surrogate guard (😀 = 2 UTF-16 units).
  corpus.push(`${"a".repeat(3999)}😀${"b".repeat(200)}`);
  corpus.push(`${"a".repeat(4095)}😀${"b".repeat(200)}`);
  return corpus;
}

const CORPUS = makeCorpus();

describe("chunkText — single-chunk fast path", () => {
  it("returns the text unchanged when under the limit", () => {
    expect(chunkText("hello", { limit: 100 })).toEqual(["hello"]);
  });
  it("returns empty string as a single chunk by default", () => {
    expect(chunkText("", { limit: 100 })).toEqual([""]);
  });
  it("drops an all-whitespace single chunk when trimParts is set", () => {
    expect(chunkText("   ", { limit: 100, trimParts: true })).toEqual([]);
  });
});

describe("chunkText — every chunk respects the window", () => {
  it("Slack family: no chunk exceeds 4000", () => {
    for (const t of CORPUS) {
      for (const c of slackViaCore(t)) expect(c.length).toBeLessThanOrEqual(4000);
    }
  });
  it("Discord family: no chunk exceeds 2000", () => {
    for (const t of CORPUS) {
      for (const c of discordViaCore(t)) expect(c.length).toBeLessThanOrEqual(2000);
    }
  });
});

describe("chunkText reproduces the adapter oracles byte-for-byte", () => {
  it("Slack (4000, space, surrogate guard, last-boundary)", () => {
    for (const t of CORPUS) expect(slackViaCore(t)).toEqual(oracleSlack(t));
  });
  it("WhatsApp (4096, trimParts)", () => {
    for (const t of CORPUS) expect(whatsappViaCore(t)).toEqual(oracleWhatsApp(t));
  });
  it("Teams (8000, trimParts)", () => {
    for (const t of CORPUS) expect(teamsViaCore(t)).toEqual(oracleTeams(t));
  });
  it("Discord (2000/1900 soft window, newline-only)", () => {
    for (const t of CORPUS) expect(discordViaCore(t)).toEqual(oracleDiscord(t));
  });
});

describe("chunkText — surrogate guard", () => {
  it("never splits an emoji in the middle (Slack family)", () => {
    const text = `${"a".repeat(3999)}😀${"b".repeat(200)}`;
    for (const c of slackViaCore(text)) {
      // A chunk must not end with a lone high surrogate.
      const last = c.charCodeAt(c.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });
});
