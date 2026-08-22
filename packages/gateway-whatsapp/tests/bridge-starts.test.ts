/**
 * Does the web bridge survive its own startup, and report failures in its own protocol?
 *
 * Every other test in this package injects `spawnFactory` and drives a `FakeChild`, which
 * is right for testing the IPC protocol and useless for testing the bridge. The script
 * itself had never been executed by anything — not a test, not CI, not the live suite,
 * which excludes the web backend by declaration. So a defect in its first fifteen lines
 * could survive a green suite indefinitely, and did: `LocalAuth` came back `undefined` and
 * the process died with a `TypeError` 1011 ms in (B-002).
 *
 * **What these tests assert, and what they deliberately do not.** Reaching a QR code needs
 * a browser this repository never downloads — `package.json` omits `puppeteer` from
 * `pnpm.onlyBuiltDependencies`, so its postinstall never runs. A correct bridge therefore
 * still exits non-zero here, reporting that it cannot find Chrome. Asserting liveness would
 * mark a correct fix as failed, so the assertion is on the SHAPE of the failure: the bridge
 * either keeps running or exits having emitted `{"event":"error"}` on stdout, and never
 * dies with an unhandled `TypeError`.
 *
 * That distinction is the whole of the fix. A bridge that reports its problem is one the
 * parent can map to a `SendResult`; a bridge that crashes leaves the backend waiting for a
 * 120-second connect timeout with nothing to say.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const BRIDGE = join(import.meta.dirname, "..", "src", "bridge", "whatsapp-web-bridge.mjs");

let scratch: string | undefined;

/**
 * A directory to run the bridge from.
 *
 * `LocalAuth` resolves its session path against the CURRENT WORKING DIRECTORY
 * (`whatsapp-web.js/src/authStrategies/LocalAuth.js:25`), so spawning from the package
 * would drop an untracked `.wwebjs_auth/` into it — the same shape as the probe leak fixed
 * in #40.
 */
function scratchDir(): string {
  scratch = mkdtempSync(join(tmpdir(), "wa-bridge-"));
  return scratch;
}

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
});

/** Is the optional peer dependency actually installed here? */
function whatsAppWebInstalled(): boolean {
  try {
    createRequire(import.meta.url).resolve("whatsapp-web.js");
    return true;
  } catch {
    return false;
  }
}

interface BridgeRun {
  readonly alive: boolean;
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run the bridge from `cwd` for `ms`, then report how it went. */
async function runBridge(cwd: string, ms: number, env: NodeJS.ProcessEnv = {}): Promise<BridgeRun> {
  const child = spawn(process.execPath, [BRIDGE, "--session", "vitest-start-check"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c: Buffer) => {
    stdout += c.toString("utf8");
  });
  child.stderr.on("data", (c: Buffer) => {
    stderr += c.toString("utf8");
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
  return { alive, code, stdout, stderr };
}

/** The structured events the bridge wrote to stdout, in order. */
function eventsFrom(stdout: string): Array<{ event: string; message?: string }> {
  return stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as { event: string; message?: string }];
      } catch {
        return [];
      }
    });
}

describe("the web bridge script", () => {
  it("never dies with an unhandled TypeError during startup", async () => {
    // The defect B-002 records. The bridge read `LocalAuth` off the module namespace, but
    // whatsapp-web.js ends its `module.exports` object with a spread, which defeats
    // cjs-module-lexer — so only some names are synthesised, and `LocalAuth` was not among
    // them. The `try/catch` around the import guards against the package being ABSENT, not
    // against a member being undefined, so the failure escaped it entirely.
    if (!whatsAppWebInstalled()) {
      console.warn("[bridge-starts] whatsapp-web.js not installed — nothing to start");
      return;
    }

    const { alive, code, stdout, stderr } = await runBridge(scratchDir(), 2_500);

    expect(
      stderr,
      `the bridge crashed instead of reporting:\n${stderr.split("\n").slice(0, 10).join("\n")}`,
    ).not.toContain("is not a constructor");

    // Either it is still running, or it stopped having said why in its own protocol.
    const reported = eventsFrom(stdout).some((e) => e.event === "error");
    expect(
      alive || reported,
      `the bridge exited ${code} with no structured error on stdout. stdout=${JSON.stringify(stdout)} stderr=${stderr.slice(0, 400)}`,
    ).toBe(true);
  }, 20_000);

  it("names the missing binding when the package is present but does not expose it", async () => {
    // The negative case (rules/testing.md § 4.1): assert the SPECIFIC typed error, not that
    // it merely failed. A stub package stands in for a future version that moves the name,
    // so the test needs no real dependency and no browser.
    const dir = scratchDir();
    const stub = join(dir, "stub-whatsapp-web.mjs");
    writeFileSync(
      stub,
      // Client present, LocalAuth absent — exactly the shape that produced B-002.
      "export default { Client: function Client() {} };\n",
    );

    const { stdout, stderr } = await runBridge(dir, 2_500, {
      THEOKIT_WHATSAPP_WEB_SPECIFIER: stub,
    });

    const errors = eventsFrom(stdout).filter((e) => e.event === "error");
    expect(
      errors.length,
      `expected a structured error, got stdout=${JSON.stringify(stdout)} stderr=${stderr.slice(0, 300)}`,
    ).toBeGreaterThan(0);
    expect(errors[0]?.message ?? "").toContain("LocalAuth");
    expect(stderr).not.toContain("is not a constructor");
  }, 20_000);

  it("still reports an absent package as absent, not as a missing binding", async () => {
    // The pre-existing failure mode must survive the fix. "Not installed" and "installed
    // but different" are two problems, and telling a consumer the wrong one sends them to
    // run `pnpm add` for a package they already have.
    const dir = scratchDir();

    const { stdout } = await runBridge(dir, 2_500, {
      THEOKIT_WHATSAPP_WEB_SPECIFIER: join(dir, "does-not-exist.mjs"),
    });

    const errors = eventsFrom(stdout).filter((e) => e.event === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message ?? "").toContain("not installed");
  }, 20_000);

  it("leaves no session directory in the package it was spawned from", async () => {
    // LocalAuth writes `.wwebjs_auth/` relative to cwd. Running the bridge from the package
    // would leave one behind, untracked and invisible until someone runs `git add -A`.
    if (!whatsAppWebInstalled()) return;

    await runBridge(scratchDir(), 2_500);

    expect(existsSync(join(import.meta.dirname, "..", ".wwebjs_auth"))).toBe(false);
  }, 20_000);
});
