/**
 * Readiness report — which platforms can actually be exercised right now.
 *
 * This is the one suite that always runs, with or without credentials. It does
 * not talk to any API; it answers the question you ask before a live run: "what
 * is wired up, and what is each missing?"
 *
 * It exists because the honest state of a live suite is otherwise invisible. Ten
 * platforms with nine skipped and one green reads, at a glance, exactly like ten
 * platforms passing. Printing the gap turns that glance into information.
 */

import { describe, expect, it } from "vitest";

import { has, liveRunEnabled, missingFor } from "../src/credentials.js";
import { PLATFORMS, type PlatformSpec } from "../src/platforms.js";

/** The lines describing one platform: its status, then each gap and how to close it. */
function describeRow(spec: PlatformSpec, missing: readonly string[]): string[] {
  const mark = missing.length === 0 ? "ready  " : "missing";
  const lines = [`  [${mark}] ${spec.label.padEnd(26)} (${spec.transport})`];
  const docs = [...spec.credentials, ...spec.target];
  for (const name of missing) {
    const doc = docs.find((c) => c.name === name);
    lines.push(`             ${name} — ${doc?.what ?? ""}`);
    if (doc !== undefined) lines.push(`             ↳ ${doc.where}`);
  }
  if (missing.length > 0 && spec.caveat !== undefined) {
    lines.push(`             ⚠ ${spec.caveat}`);
  }
  return lines;
}

describe("live-test readiness", () => {
  it("reports what is configured, and what each missing platform still needs", () => {
    const rows = PLATFORMS.map((spec) => {
      const missing = missingFor(spec);
      return { spec, missing, ready: missing.length === 0 };
    });

    const ready = rows.filter((r) => r.ready).length;
    const lines = [
      "",
      `Live run enabled (INTEGRATION_LIVE): ${liveRunEnabled() ? "yes" : "NO — suites will skip"}`,
      `Platforms ready: ${ready}/${rows.length}`,
      "",
      ...rows.flatMap((row) => describeRow(row.spec, row.missing)),
      "",
    ];
    process.stdout.write(`${lines.join("\n")}\n`);

    // The report is the point; the assertion only guards the report itself.
    expect(rows.length).toBe(PLATFORMS.length);
  });

  it("never reads a credential VALUE into the report", () => {
    // A readiness report that printed values would leak every secret into CI
    // logs. It may only ever answer set/not-set.
    for (const spec of PLATFORMS) {
      for (const cred of [...spec.credentials, ...spec.target]) {
        expect(typeof has(cred.name)).toBe("boolean");
      }
    }
  });

  it("gives every platform at least one credential and one target", () => {
    // A platform with no target has nowhere safe to send, and would otherwise
    // look "ready" while being untestable.
    for (const spec of PLATFORMS) {
      expect(spec.credentials.length, `${spec.id} credentials`).toBeGreaterThan(0);
      expect(spec.target.length, `${spec.id} target`).toBeGreaterThan(0);
    }
  });

  it("uses a unique environment variable name across every platform", () => {
    // Two platforms sharing a name would silently authenticate one with the
    // other's credential.
    const seen = new Map<string, string>();
    for (const spec of PLATFORMS) {
      for (const cred of [...spec.credentials, ...spec.target]) {
        const prior = seen.get(cred.name);
        expect(prior, `${cred.name} declared by both ${prior} and ${spec.id}`).toBeUndefined();
        seen.set(cred.name, spec.id);
      }
    }
  });

  it("has a test directory for every platform id, and no orphan directories", async () => {
    // Keeps the registry and the suites from drifting apart: a platform added
    // here with no suite, or a suite for a platform nobody registered.
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(new URL(".", import.meta.url), { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const ids = PLATFORMS.map((p) => p.id);
    for (const dir of dirs) {
      expect(ids, `tests/${dir}/ has no entry in PLATFORMS`).toContain(dir);
    }
    // The other direction, which this test claimed in its name and comment and
    // did not check. Teams, WhatsApp and SMS sat in the registry with no suite
    // at all for as long as it was one-sided — three of ten platforms invisible
    // while the readiness report stayed green, which is the failure this file
    // exists to make impossible.
    //
    // A platform with no credentials still gets a suite. It then skips with the
    // variable it wants named, and "9 skipped, 1 passed" is information; a
    // missing file is absence wearing the same colour as coverage.
    for (const id of ids) {
      expect(dirs, `PLATFORMS has "${id}" but tests/${id}/ does not exist`).toContain(id);
    }
  });
});
