/**
 * Pin test for `splitForDiscord` (roadmap M0, step 4).
 *
 * Captures the CURRENT behavior before the M1 migration onto core `chunkText`,
 * so the conversion can be proven output-identical. Discord's shape is the
 * Telegram family: 2000 hard cap, 1900 soft window, `\n\n` → `\n` → window
 * boundary preference, newline-only leading strip, no surrogate guard.
 */

import { describe, expect, it } from "vitest";

import { splitForDiscord } from "../src/split.js";

describe("splitForDiscord", () => {
  it("returns short text unchanged as a single chunk", () => {
    expect(splitForDiscord("hello")).toEqual(["hello"]);
    expect(splitForDiscord("")).toEqual([""]);
  });

  it("returns text at exactly the 2000 cap as a single chunk", () => {
    const t = "a".repeat(2000);
    expect(splitForDiscord(t)).toEqual([t]);
  });

  it("splits a boundary-less block at the 1900 soft window", () => {
    const t = "x".repeat(2500);
    const parts = splitForDiscord(t);
    expect(parts).toEqual(["x".repeat(1900), "x".repeat(600)]);
  });

  it("prefers a paragraph boundary and strips leading newlines on continuation", () => {
    const head = "p".repeat(1800);
    const tail = "q".repeat(400);
    const parts = splitForDiscord(`${head}\n\n${tail}`);
    expect(parts).toEqual([head, tail]);
  });

  it("never emits a chunk longer than the 2000 hard cap", () => {
    for (const size of [1901, 2000, 2001, 3800, 5000, 9999]) {
      const t = "abc def ".repeat(Math.ceil(size / 8)).slice(0, size);
      for (const c of splitForDiscord(t)) expect(c.length).toBeLessThanOrEqual(2000);
    }
  });
});
