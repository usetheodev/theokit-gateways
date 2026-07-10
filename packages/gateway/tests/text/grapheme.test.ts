/**
 * Golden tests for `chunkByGrapheme` (roadmap M1).
 *
 * Embeds verbatim copies of the pre-migration `splitForLine` / `splitForSMS`
 * grapheme walks as reference oracles and asserts `chunkByGrapheme` (plus the
 * SMS prefix applied by the wrapper) reproduces them byte-for-byte across a
 * deterministic corpus.
 */

import { describe, expect, it } from "vitest";

import { chunkByGrapheme } from "../../src/text/chunk.js";

// --- Reference oracles (verbatim pre-M1 logic) -----------------------------

function oracleLine(text: string, limit = 5000): string[] {
  if (text.length === 0) return [""];
  if (text.length <= limit) return [text];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const segments = Array.from(segmenter.segment(text), (s) => s.segment);
  const parts: string[] = [];
  let buf = "";
  for (const seg of segments) {
    if (buf.length + seg.length > limit) {
      if (buf.length > 0) parts.push(buf);
      buf = "";
    }
    buf += seg;
  }
  if (buf.length > 0) parts.push(buf);
  return parts;
}

function oracleSMS(text: string, limit = 1600): string[] {
  const PART_PREFIX_RESERVED = 8;
  if (text.length === 0) return [""];
  if (text.length <= limit) return [text];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const segments = Array.from(segmenter.segment(text), (s) => s.segment);
  const parts: string[] = [];
  const cap = limit - PART_PREFIX_RESERVED;
  let buf = "";
  for (const seg of segments) {
    if (buf.length + seg.length > cap) {
      if (buf.length > 0) parts.push(buf);
      buf = "";
    }
    buf += seg;
  }
  if (buf.length > 0) parts.push(buf);
  if (parts.length === 1) return parts;
  const total = parts.length;
  return parts.map((p, i) => `(${i + 1}/${total}) ${p}`);
}

// --- chunkByGrapheme configured per family ---------------------------------

const lineViaCore = (t: string) => chunkByGrapheme(t, { limit: 5000 });

const smsViaCore = (t: string): string[] => {
  const parts = chunkByGrapheme(t, { limit: 1600, partLimit: 1600 - 8 });
  if (parts.length <= 1) return parts;
  const total = parts.length;
  return parts.map((p, i) => `(${i + 1}/${total}) ${p}`);
};

function makeCorpus(): string[] {
  const corpus: string[] = ["", "short", "🇧🇷🇧🇷 regional indicators", "a̐éö̲ combining"];
  const word = "the quick brown fox 🦊 ";
  for (const size of [1592, 1593, 1599, 1600, 1601, 3200, 4999, 5000, 5001, 12000]) {
    let s = "";
    while (s.length < size) s += word;
    corpus.push(s.slice(0, size));
    corpus.push("x".repeat(size));
  }
  // Grapheme straddling the SMS cap (1592): 😀 = 2 UTF-16 units at the boundary.
  corpus.push(`${"x".repeat(1591)}😀${"y".repeat(50)}`);
  return corpus;
}

const CORPUS = makeCorpus();

describe("chunkByGrapheme — input validation (fail fast)", () => {
  it("throws on non-positive limit", () => {
    expect(() => chunkByGrapheme("abc", { limit: 0 })).toThrow(RangeError);
    expect(() => chunkByGrapheme("abc", { limit: -1 })).toThrow(/positive integer/);
  });
  it("throws on non-positive partLimit", () => {
    expect(() => chunkByGrapheme("abc", { limit: 100, partLimit: 0 })).toThrow(/partLimit/);
  });
  it("accepts a valid partLimit below limit", () => {
    expect(() => chunkByGrapheme("abc", { limit: 100, partLimit: 92 })).not.toThrow();
  });
});

describe("chunkByGrapheme — fast paths", () => {
  it("empty string → single empty chunk", () => {
    expect(chunkByGrapheme("", { limit: 100 })).toEqual([""]);
  });
  it("short text unchanged", () => {
    expect(chunkByGrapheme("hi", { limit: 100 })).toEqual(["hi"]);
  });
});

describe("chunkByGrapheme reproduces the adapter oracles byte-for-byte", () => {
  it("LINE (limit 5000)", () => {
    for (const t of CORPUS) expect(lineViaCore(t)).toEqual(oracleLine(t));
  });
  it("SMS (limit 1600, reserved prefix, (i/N))", () => {
    for (const t of CORPUS) expect(smsViaCore(t)).toEqual(oracleSMS(t));
  });
});

describe("chunkByGrapheme — never severs a grapheme", () => {
  it("keeps 🦊 (surrogate pair) intact across chunk edges", () => {
    const text = `${"🦊".repeat(2000)}`; // each 🦊 = 2 UTF-16 units
    for (const c of chunkByGrapheme(text, { limit: 1000 })) {
      const last = c.charCodeAt(c.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });
});
