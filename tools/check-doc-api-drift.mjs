#!/usr/bin/env node
// Documentation-vs-API drift gate.
//
// Every README in this repository opens by telling a consumer to write an import. Nothing checked
// that the names in those imports exist. A published example that does not compile is a first
// impression, and it is the cheapest way there is to lose a reader who was about to try the thing.
//
// THE ORACLE IS THE COMPILER, NOT A REGEX OVER `.d.ts` TEXT. Matching names is exactly what fails
// here: an export can be written in a form a hand-rolled parser does not read, and the parser then
// reports a real export as missing. Each `import { ... } from "@theokit/..."` found in a tracked
// markdown file becomes a generated probe; `tsc --noEmit` says which names do not resolve, and each
// diagnostic is mapped back to the artifact and line that claimed it.
//
// EACH DOCUMENT IS RESOLVED WHERE ITS READER STANDS. `packages/gateway-slack/README.md` is read by a
// consumer of that package, who has its peer dependencies — `@theokit/sdk` among them — so its
// examples are compiled from inside `packages/gateway-slack`. A package cannot resolve its own name
// that way (there is no self-link in `node_modules`), and repository-level docs belong to no package
// at all, so both fall back to `integration/`, the one workspace member that declares all eleven
// gateway packages as dependencies.
//
// "COULD NOT CHECK" IS NOT "IS WRONG". A module that fails to RESOLVE (TS2307) says the probe stood
// in the wrong place; a name that is missing from a module that did resolve (TS2305/TS2724) says the
// documentation is wrong. The first version conflated them and accused five READMEs of naming types
// that do not exist, when the truth was that `@theokit/sdk` is not linked into `integration/`. Those
// are reported apart, and an unresolvable module fails the run as a broken gate (exit 2) rather than
// as a documentation defect.
//
// This reads the PUBLISHED declarations, so `pnpm build` must have run first.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publishedPackages, ROOT } from "./lib/published-entries.mjs";

const LABEL = "doc-api-drift";
const PROBE_DIRNAME = ".doc-probes";

/** `import { A, type B } from "@theokit/gateway"` — the shape every README example uses. */
const IMPORT = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["'](@theokit\/[^"']+)["']/g;

/** Tracked markdown, minus changesets — those describe a release, not an API. */
function documentationFiles() {
  return execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((path) => path.length > 0 && !path.startsWith(".changeset/"));
}

/** Every documented import, with the artifact and line that claims it. */
function documentedImports() {
  const claims = [];
  for (const file of documentationFiles()) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const match of text.matchAll(IMPORT)) {
      const names = match[1]
        .split(",")
        .map((name) => name.trim().replace(/^type\s+/, ""))
        .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
      if (names.length === 0) continue;
      claims.push({
        file,
        line: text.slice(0, match.index).split("\n").length,
        specifier: match[2],
        names,
      });
    }
  }
  return claims;
}

/** Where a reader of `file` stands: its own package first, then the workspace member that has them all. */
function resolutionRoots(file) {
  const roots = [];
  const owner = /^(packages\/[^/]+)\//.exec(file);
  if (owner !== null) roots.push(join(ROOT, owner[1]));
  roots.push(join(ROOT, "integration"));
  return roots;
}

/** The first root where `specifier` is actually linked, or undefined when none is. */
function rootResolving(file, specifier) {
  return resolutionRoots(file).find((root) =>
    existsSync(join(root, "node_modules", specifier, "package.json")),
  );
}

const unbuilt = publishedPackages().filter((pkg) => !pkg.built);
if (unbuilt.length > 0) {
  console.error(
    `[${LABEL}] x ${unbuilt.map((pkg) => pkg.name).join(", ")} have no dist/ — run pnpm build`,
  );
  console.error(
    "  Refusing to report: the names would resolve against declarations that do not exist.",
  );
  process.exit(2);
}

const claims = documentedImports();
if (claims.length === 0) {
  // Not a pass. Every README here opens with an import example; finding none means the extraction
  // broke, and reporting green on that is how a gate starts checking nothing while looking healthy.
  console.error(
    `[${LABEL}] x no documented imports found — the extraction is broken, not the docs`,
  );
  process.exit(2);
}

const unresolvable = [];
const byRoot = new Map();
for (const claim of claims) {
  const root = rootResolving(claim.file, claim.specifier);
  if (root === undefined) {
    unresolvable.push(claim);
    continue;
  }
  if (!byRoot.has(root)) byRoot.set(root, []);
  byRoot.get(root).push(claim);
}

const drifted = [];
const notChecked = [...unresolvable];

for (const [root, rootClaims] of byRoot) {
  const probeDir = join(root, PROBE_DIRNAME);
  rmSync(probeDir, { recursive: true, force: true });
  mkdirSync(probeDir, { recursive: true });

  // One probe per claim, so a diagnostic's file name identifies the artifact that made the claim.
  const probes = rootClaims.map((claim, index) => {
    const probe = join(probeDir, `probe-${index}.ts`);
    writeFileSync(
      probe,
      `import type { ${claim.names.join(", ")} } from ${JSON.stringify(claim.specifier)};\n`,
    );
    return { probe, claim };
  });

  let output = "";
  try {
    execFileSync(
      "npx",
      [
        "tsc",
        "--noEmit",
        "--strict",
        "--target",
        "es2022",
        "--module",
        "esnext",
        "--moduleResolution",
        "bundler",
        "--skipLibCheck",
        ...probes.map((entry) => entry.probe),
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    // A failed invocation is not a clean compile.
    if (typeof error.status !== "number") {
      console.error(`[${LABEL}] x tsc could not be run: ${error.message}`);
      console.error(
        "  Refusing to report: a gate that cannot invoke its tool has checked nothing.",
      );
      rmSync(probeDir, { recursive: true, force: true });
      process.exit(2);
    }
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }

  for (const raw of output.split("\n")) {
    const match = /probe-(\d+)\.ts\(\d+,\d+\): error (TS\d+): (.+)$/.exec(raw.trim());
    if (match === null) continue;
    const entry = probes[Number(match[1])];
    if (entry === undefined) continue;
    if (match[2] === "TS2307") {
      notChecked.push(entry.claim); // the module did not resolve — the probe stood wrong, not the doc
      continue;
    }
    const name = /has no exported member(?: named)? '([^']+)'/.exec(match[3])?.[1];
    drifted.push({ ...entry.claim, name: name ?? entry.claim.names.join(", ") });
  }

  rmSync(probeDir, { recursive: true, force: true });
}

const checkedNames = claims
  .filter((claim) => !notChecked.includes(claim))
  .reduce((total, claim) => total + claim.names.length, 0);

if (notChecked.length > 0) {
  console.error(
    `[${LABEL}] x ${notChecked.length} import(s) could not be checked — module unresolvable:`,
  );
  for (const claim of notChecked) {
    console.error(
      `      ${claim.file}:${claim.line} — ${claim.specifier} is not linked from any candidate root`,
    );
  }
  console.error(
    "  This is a gap in the gate, not a defect in the documentation. Link the package or teach",
  );
  console.error("  the gate where a reader of that document stands.");
}

if (drifted.length > 0) {
  console.error(`\n[${LABEL}] FAIL — ${drifted.length} documented name(s) do not exist:`);
  for (const item of drifted) {
    console.error(`      ${item.file}:${item.line} — ${item.specifier} has no '${item.name}'`);
  }
  console.error("\n  A reader who copies one of these gets code that does not compile.");
}

if (drifted.length > 0 || notChecked.length > 0) process.exit(drifted.length > 0 ? 1 : 2);

console.log(
  `[${LABEL}] PASS — ${checkedNames} documented name(s) across ${claims.length} import(s) in ${
    new Set(claims.map((claim) => claim.file)).size
  } file(s) all resolve.`,
);
