/**
 * Destroys a provisioned server AND forgets the credentials it issued.
 *
 * The second half is the point. Tearing the container down while leaving
 * MATRIX_* or MATTERMOST_* in `.env` leaves the suite pointing at a server that
 * no longer exists — so it FAILS where it should SKIP, and the report reads as a
 * broken adapter rather than an absent fixture. That happened on the first full
 * run after adding Mattermost, and it is the kind of noise that teaches people
 * to ignore a red suite.
 *
 * Teardown removing exactly what bootstrap wrote keeps the two symmetrical:
 * either the server and its credentials both exist, or neither does.
 *
 * Run: pnpm --filter @theokit/gateway-integration matrix:down
 *      pnpm --filter @theokit/gateway-integration mattermost:down
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PLATFORM = process.argv[2];
if (PLATFORM !== "matrix" && PLATFORM !== "mattermost") {
  process.stderr.write("usage: teardown-docker.ts <matrix|mattermost>\n");
  process.exit(1);
}

const PREFIXES: Record<string, string> = {
  matrix: "MATRIX_",
  mattermost: "MATTERMOST_",
};

const COMPOSE = join(import.meta.dirname, "..", "docker", PLATFORM, "docker-compose.yml");
const ENV_PATH = join(import.meta.dirname, "..", ".env");

const down = spawnSync("docker", ["compose", "-f", COMPOSE, "down", "-v"], { encoding: "utf8" });
if (down.status !== 0) {
  // Not fatal: the container may already be gone, and the env still needs clearing.
  process.stderr.write(`docker compose down exited ${down.status}\n`);
}

const prefix = PREFIXES[PLATFORM] ?? "";
let removed = 0;
try {
  const text = readFileSync(ENV_PATH, "utf8");
  const kept = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .filter((line) => {
      const isOurs = line.trimStart().startsWith(prefix);
      if (isOurs) removed += 1;
      return !isOurs;
    });
  writeFileSync(ENV_PATH, `${kept.join("\n")}\n`);
} catch {
  // No .env is fine — nothing to forget.
}

process.stdout.write(`${PLATFORM}: container removed, ${removed} ${prefix}* entries cleared\n`);
