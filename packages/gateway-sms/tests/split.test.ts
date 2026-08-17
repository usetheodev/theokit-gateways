import { describe, expect, it } from "vitest";

import { splitForSMS } from "../src/split.js";

describe("splitForSMS (D393, EC-7)", () => {
  it("returns single chunk for short text", () => {
    expect(splitForSMS("hi")).toEqual(["hi"]);
  });

  it("returns single chunk at exactly the default limit", () => {
    const text = "x".repeat(1600);
    expect(splitForSMS(text)).toEqual([text]);
  });

  it("EC-7: long text segmented with (i/N) prefix on each part", () => {
    const text = "x".repeat(3000);
    const parts = splitForSMS(text);
    expect(parts.length).toBeGreaterThan(1);
    for (let i = 0; i < parts.length; i++) {
      expect(parts[i]).toMatch(/^\(\d+\/\d+\) /);
    }
    expect(parts[0]?.startsWith("(1/")).toBe(true);
    expect(parts[parts.length - 1]?.startsWith(`(${parts.length}/${parts.length})`)).toBe(true);
  });

  it("preserves grapheme cluster (emoji not severed)", () => {
    // 🇧🇷 = 2 codepoints (regional indicators). Build text where
    // the emoji sits right at the boundary that naive code-unit split
    // would land on. We construct exactly one emoji at position cap-1.
    const filler = "x".repeat(1591); // 1591 + " " + 🇧🇷 = 1600+ ish
    const text = `${filler} 🇧🇷${"y".repeat(20)}`;
    const parts = splitForSMS(text);
    // Each part should be valid UTF-16 — easiest assertion: re-joining
    // must equal the original (modulo prefixes).
    const joined = parts.map((p) => p.replace(/^\(\d+\/\d+\) /, "")).join("");
    expect(joined).toBe(text);
  });

  it("respects custom limit", () => {
    const text = "x".repeat(200);
    const parts = splitForSMS(text, 100);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      // 100 cap, minus the width reserved for "(i/N) ".
      expect(p.length).toBeLessThanOrEqual(100);
    }
  });

  it("empty text returns single empty string", () => {
    expect(splitForSMS("")).toEqual([""]);
  });

  describe("the (i/N) prefix must fit inside the cap at any part count", () => {
    /**
     * The reservation used to be the constant 8, commented `"(99/99) " worst
     * case`. It is only the worst case below 100 parts: `"(100/126) "` is 10.
     * Past the hundredth part every prefix outgrew its reservation and each part
     * shipped 2 chars over the cap the caller declared — the provider rejects it,
     * so a long agent reply died at part 100.
     *
     * The guarding test used `"x".repeat(200)` with `limit: 100`: 3 parts, prefix
     * always 6 chars, reservation never stressed. A test that cannot reach the
     * failing regime is not a guard, it is decoration. These reach it.
     */
    it.each([
      ["3-digit part counts", 200_000, 1600],
      ["a low cap driving thousands of parts", 50_000, 40],
      ["exactly around the 99→100 boundary", 1600 * 100, 1600],
    ])("holds the cap with %s", (_label, size, limit) => {
      const parts = splitForSMS("x".repeat(size), limit);
      const over = parts.filter((p) => p.length > limit);
      expect(over).toEqual([]);
    });

    it("still labels every part correctly once the prefix widens", () => {
      const parts = splitForSMS("x".repeat(200_000), 1600);
      expect(parts.length).toBeGreaterThan(99);
      for (let i = 0; i < parts.length; i += 1) {
        expect(parts[i]?.startsWith(`(${i + 1}/${parts.length}) `)).toBe(true);
      }
    });

    it("loses no characters when the reservation is recomputed", () => {
      const text = "x".repeat(200_000);
      const parts = splitForSMS(text, 1600);
      const joined = parts.map((p) => p.replace(/^\(\d+\/\d+\) /, "")).join("");
      expect(joined).toBe(text);
    });

    it("rejects a limit too small to carry any payload", () => {
      // Reserving the prefix out of a tiny cap would leave a non-positive
      // partLimit. Failing loudly beats emitting parts that are all prefix.
      expect(() => splitForSMS("x".repeat(100), 4)).toThrow(RangeError);
    });
  });
});
