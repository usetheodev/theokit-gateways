// The published declaration entries of every workspace package, resolved ONE way.
//
// Both `check-dts-typechecks.mjs` and `repair-dts-imports.mjs` need this list, and they must agree:
// if the gate checked an entry the repair never touched, a green run would mean nothing. Sharing the
// resolution is what keeps the two honest about looking at the same files.
//
// Every package here publishes a single `.` entry in two module formats. Both are checked: the
// declarations are emitted separately and the defect this guards against has appeared identically in
// each, so checking only the ESM one would leave half the consumers unprotected.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @returns {Array<{name: string, dir: string, entries: string[], built: boolean}>} one row per
 * workspace package, in directory order. `built` is false when `dist/` is absent — reported by the
 * caller rather than skipped, because a gate whose green can mean "there was nothing to check" is
 * not a gate.
 */
export function publishedPackages() {
  const packagesDir = join(ROOT, "packages");
  const rows = [];
  for (const name of readdirSync(packagesDir).sort()) {
    const dir = join(packagesDir, name);
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const meta = JSON.parse(readFileSync(manifest, "utf8"));
    const entries = [join(dir, "dist", "index.d.ts"), join(dir, "dist", "index.d.cts")].filter(
      (path) => existsSync(path),
    );
    rows.push({ name: meta.name, dir, entries, built: entries.length > 0 });
  }
  return rows;
}
