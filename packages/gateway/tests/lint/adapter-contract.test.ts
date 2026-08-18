/**
 * Lint test — cross-adapter contract invariants that no single package can see.
 *
 * Ten adapters implement the same contract in ten repositories of code. When one
 * of them quietly diverges, every test in that package still passes, because a
 * package's tests only ever compare it against itself. That is exactly how two
 * defects shipped:
 *
 * - Email and Teams returned an unsubscribe with no handler-identity guard. The
 *   other eight had `if (this.handler === handler)`. The sequence that breaks —
 *   `onInbound(A)` then `onInbound(B)` then A's stale unsubscribe — silently
 *   deafened the gateway, and only two of ten packages tested unsubscribe at
 *   all, neither in that order.
 * - WhatsApp's `connect()` had no connected-guard, so calling it twice opened
 *   two live sessions. Its own test asserted `connectCalls === 2` and called
 *   that idempotent.
 *
 * Behavioural tests for both now live in the packages that had the bugs. This
 * file exists for the divergence CLASS: it reads every adapter's source and
 * fails when one stops matching its nine siblings. It is a structural gate, in
 * the same spirit as `no-ptbr.test.ts`, and it is honest about that — it proves
 * the guard is present in the source, not that it behaves correctly. The
 * per-package tests prove the behaviour; this one prevents a silent drift that
 * no per-package test can be asked to notice.
 *
 * @internal
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGES_DIR = join(__dirname, "..", "..", "..");

/** Every `gateway-*` package that ships a platform adapter. */
async function adapterSources(): Promise<Array<{ pkg: string; source: string }>> {
  const entries = await readdir(PACKAGES_DIR, { withFileTypes: true });
  const out: Array<{ pkg: string; source: string }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("gateway-")) continue;
    const path = join(PACKAGES_DIR, entry.name, "src", "adapter.ts");
    try {
      out.push({ pkg: entry.name, source: await readFile(path, "utf8") });
    } catch {
      // A gateway-* package without src/adapter.ts is not an adapter package.
    }
  }
  return out.sort((a, b) => a.pkg.localeCompare(b.pkg));
}

describe("cross-adapter contract", () => {
  it("finds every adapter package", async () => {
    // If this drops to a handful, the glob broke and the assertions below became
    // vacuous — the failure mode a tree-scanning gate has to guard against.
    const sources = await adapterSources();
    expect(sources.length).toBeGreaterThanOrEqual(10);
  });

  it("guards every returned unsubscribe on handler identity", async () => {
    const offenders: string[] = [];
    for (const { pkg, source } of await adapterSources()) {
      // The handler field is named `handler` in some adapters and
      // `inboundHandler` in others; both spellings are accepted.
      const guarded =
        /if\s*\(\s*this\.(?:inboundH|h)andler\s*===\s*handler\s*\)/.test(source) ||
        // WhatsApp unsubscribes through the backend handle instead of nulling a
        // field, which is a different mechanism with the same guarantee.
        /this\.inboundUnsubscribe\?\.\(\)/.test(source);
      if (!guarded) offenders.push(pkg);
    }
    expect(offenders).toEqual([]);
  });

  it("guards every connect() against opening a second session", async () => {
    const offenders: string[] = [];
    for (const { pkg, source } of await adapterSources()) {
      const connectBody = source.slice(source.indexOf("async connect("));
      if (connectBody.length === 0) continue;
      const head = connectBody.slice(0, 400);
      if (!/if\s*\(\s*(?:this\.connected|!?this\.\w+)\b/.test(head)) offenders.push(pkg);
    }
    expect(offenders).toEqual([]);
  });
});
