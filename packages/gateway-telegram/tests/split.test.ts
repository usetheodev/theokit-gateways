/**
 * Tests for splitForTelegram (T5.1, EC-J markdown-pair preservation).
 */

import { describe, expect, it } from "vitest";

import { splitForTelegram } from "../src/split.js";

describe("splitForTelegram (T5.1)", () => {
  it("short text returns single chunk", () => {
    expect(splitForTelegram("hello")).toEqual(["hello"]);
  });

  it("splits text longer than 4096 chars", () => {
    const big = "a".repeat(8000);
    const parts = splitForTelegram(big);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(4096);
    }
    expect(parts.join("")).toBe(big);
  });

  it("EC-J: preserves markdown ** pairs across chunks", () => {
    // Build a string that would split mid-pair without balancing.
    const prefix = "**bold** ".repeat(440); // ~4000 chars
    const trailing = ` **second-half-bold**${" extra".repeat(100)}`;
    const text = prefix + trailing;
    const parts = splitForTelegram(text);
    expect(parts.length).toBeGreaterThan(1);
    // Each chunk must have balanced ** markers.
    for (const p of parts) {
      const count = (p.match(/\*\*/g) ?? []).length;
      expect(count % 2).toBe(0);
    }
  });

  it("EC-J: balances backticks when input is split-eligible", () => {
    const code = "`x` ".repeat(1500); // 6000 chars, balanced
    const parts = splitForTelegram(code);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      const count = (p.match(/`/g) ?? []).length;
      expect(count % 2).toBe(0);
    }
  });

  it("prefers paragraph break boundary when available", () => {
    // 15 chars x 400 = 6000, comfortably over the 4096 cap. The earlier corpus
    // used .repeat(200) = 3000 chars, which the `text.length <= 4096` fast path
    // returned whole: parts.length was 1, the loop bound `i < 0` never ran, and
    // this test executed ZERO assertions. It passed against any implementation,
    // including one that cut blindly at 4096 with no boundary preference at all.
    const para = "paragraph one\n\n".repeat(400);
    const parts = splitForTelegram(para);
    expect(parts.length).toBeGreaterThan(1);
    let asserted = 0;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const tail = parts[i]?.slice(-20) ?? "";
      // tail should NOT end with a partial word (heuristic — letters only).
      expect(/[a-z]$/.test(tail) && !tail.includes("\n")).toBe(false);
      asserted += 1;
    }
    // Guards the guard: if the corpus ever falls back under the cap, this fails
    // instead of silently asserting nothing again.
    expect(asserted).toBeGreaterThan(0);
  });

  describe("termination (EC-J must never cost forward progress)", () => {
    /**
     * `balanceMarkdownPairs` trims back to before an unbalanced marker. When the
     * only unbalanced marker sits at index 0, it trimmed the chunk to `""`, so
     * `boundary` became 0 and `remaining.slice(0)` returned the same string
     * forever: an unbounded array of `""` and a pegged CPU.
     *
     * The loop is synchronous, so it blocks the event loop — a vitest per-test
     * timeout cannot interrupt it, and the whole run has to be killed from
     * outside. That is why these tests assert on a RESULT rather than relying on
     * a timeout to catch a regression.
     */
    it("terminates when an unclosed backtick opens the text", () => {
      const text = `\`${"a".repeat(8000)}`;
      const parts = splitForTelegram(text);
      expect(parts.length).toBeGreaterThan(1);
      expect(parts.length).toBeLessThan(20);
      expect(parts.every((p) => p.length > 0)).toBe(true);
      expect(parts.join("")).toBe(text);
    });

    it.each([
      ["backtick", "`"],
      ["bold", "**"],
      ["underline", "__"],
      ["strike", "~~"],
    ])("terminates when an unclosed %s marker opens the text", (_label, marker) => {
      const text = `${marker}${"b".repeat(9000)}`;
      const parts = splitForTelegram(text);
      expect(parts.length).toBeGreaterThan(1);
      expect(parts.every((p) => p.length > 0)).toBe(true);
      expect(parts.join("")).toBe(text);
    });

    it("emits the raw window when balancing would empty the chunk", () => {
      // No complete pair exists anywhere in the first window, so balancing has
      // nothing to trim back to. Emitting an unbalanced chunk is the only
      // progress-making option, and is strictly better than hanging: Telegram
      // answers a markdown_parse_error, the process survives.
      const text = `\`${"c".repeat(8000)}`;
      const parts = splitForTelegram(text);
      expect(parts[0]?.length).toBeGreaterThan(0);
      expect(parts[0]?.startsWith("`")).toBe(true);
    });

    it("still balances when a complete pair exists earlier in the window", () => {
      // Regression guard on the fix: the fallback must not disable EC-J whenever
      // balancing CAN find a boundary.
      const text = `\`x\` ${"d".repeat(5000)}\`unclosed${"e".repeat(5000)}`;
      const parts = splitForTelegram(text);
      expect(parts.length).toBeGreaterThan(1);
      expect(parts.every((p) => p.length > 0)).toBe(true);
    });

    it("never drops characters, whatever the balancing does", () => {
      const text = `**${"f".repeat(3000)}\`${"g".repeat(6000)}`;
      const parts = splitForTelegram(text);
      // Chunks are cut, never edited — a lost character is silent data loss in
      // an agent's reply.
      expect(parts.join("")).toBe(text);
    });
  });
});
