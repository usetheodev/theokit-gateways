/**
 * Does the web bridge actually start?
 *
 * Every other test in this package injects `spawnFactory` and drives a `FakeChild`, which
 * is right for testing the protocol and useless for testing the bridge. The script itself
 * had never been executed by anything — not a test, not CI, not the live suite, which
 * excludes the web backend entirely. So a defect in its first fifteen lines could survive
 * a green suite indefinitely, and did.
 *
 * This spawns the real script against the real `whatsapp-web.js` and asks the smallest
 * question that would have caught it: does the process still exist a moment later?
 *
 * It deliberately stops short of Chromium. Reaching a QR code needs a browser this
 * repository never downloads — `package.json` omits `puppeteer` from
 * `pnpm.onlyBuiltDependencies`, so its postinstall never runs — and a test that needed one
 * could not run here at all. The defect this covers happens before any browser is touched.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const BRIDGE = join(import.meta.dirname, "..", "src", "bridge", "whatsapp-web-bridge.mjs");

/** Is the optional peer dependency actually installed here? */
function whatsAppWebInstalled(): boolean {
  try {
    createRequire(import.meta.url).resolve("whatsapp-web.js");
    return true;
  } catch {
    return false;
  }
}

/** Run the bridge for `ms` and report how it went. */
async function runBridge(
  ms: number,
): Promise<{ alive: boolean; stderr: string; code: number | null }> {
  const child = spawn(process.execPath, [BRIDGE, "--session", "vitest-start-check"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    child.once("exit", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });

  const alive = code === null;
  if (alive) child.kill("SIGKILL");
  return { alive, stderr, code };
}

describe("the web bridge script", () => {
  it("survives its own module initialisation", async () => {
    // The bridge destructures `Client` and `LocalAuth` off the module namespace. Only one
    // of them is a named export of whatsapp-web.js; the other lives on the default. The
    // `try/catch` around the import guards against the package being ABSENT, not against
    // a member being undefined, so the failure surfaces later as a TypeError that kills
    // the process — and the friendly "not installed" message never runs.
    if (!existsSync(BRIDGE)) throw new Error(`bridge script missing at ${BRIDGE}`);
    if (!whatsAppWebInstalled()) {
      // Skipping loudly beats asserting against a dependency that is not here. This is an
      // optional peer dependency and a consumer may legitimately not have it.
      console.warn("[bridge-starts] whatsapp-web.js not installed — nothing to start");
      return;
    }

    const { alive, stderr, code } = await runBridge(2_500);

    expect(
      alive,
      `the bridge exited with code ${code} during startup:\n${stderr.split("\n").slice(0, 12).join("\n")}`,
    ).toBe(true);
    expect(stderr).not.toContain("is not a constructor");
  }, 20_000);
});
