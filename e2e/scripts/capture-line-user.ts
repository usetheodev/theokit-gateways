/**
 * Captures `LINE_TEST_USER_ID` from one real webhook delivery.
 *
 * LINE is the only platform here where the target id cannot be read from any
 * console or API: `/v2/bot/followers/ids` answers 403 "Access to this API is not
 * available for your account" on an unverified Official Account, and neither the
 * Developers Console nor the Official Account Manager shows the raw `U…`
 * anywhere. Adding the bot as a friend is not enough.
 *
 * What IS available is a webhook delivery, which carries `source.userId`. So
 * this opens a throwaway HTTPS tunnel, serves one request, takes the id, and
 * shuts everything down. The id never changes, so this runs once — the outbound
 * suite then works forever with no tunnel.
 *
 * Deliberately small: no persistent tunnel, no named DNS, no daemon. Those would
 * be infrastructure for a need that does not exist yet.
 *
 * Run: pnpm --filter @theokit/gateway-e2e capture:line
 */

import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const CACHE = join(import.meta.dirname, "..", ".cache");
const BIN = join(CACHE, "cloudflared");
const ENV_PATH = join(import.meta.dirname, "..", ".env");
const PORT = Number(process.env.LINE_CAPTURE_PORT ?? "8787");

function ensureCloudflared(): void {
  if (existsSync(BIN)) return;
  mkdirSync(CACHE, { recursive: true });
  process.stdout.write("downloading cloudflared…\n");
  const url =
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64";
  const res = spawnSync("curl", ["-sSfL", "-o", BIN, url], { encoding: "utf8" });
  if (res.status !== 0) {
    process.stderr.write(`could not download cloudflared: ${res.stderr}\n`);
    process.exit(1);
  }
  chmodSync(BIN, 0o755);
}

function upsertEnv(key: string, value: string): void {
  let text = "";
  try {
    text = readFileSync(ENV_PATH, "utf8");
  } catch {
    // First write.
  }
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  const idx = lines.findIndex((l) => l.trimStart().startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(ENV_PATH, `${lines.join("\n")}\n`);
}

ensureCloudflared();

/** Resolves with the first `source.userId` LINE delivers. */
const captured = new Promise<string>((resolve) => {
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (c: string) => {
      body += c;
    });
    req.on("end", () => {
      // Answer 200 whatever happens: LINE retries anything else, and this
      // endpoint exists for one delivery only.
      res.writeHead(200).end();
      try {
        const parsed = JSON.parse(body) as {
          events?: Array<{ source?: { userId?: string } }>;
        };
        const id = parsed.events?.find((e) => e.source?.userId !== undefined)?.source?.userId;
        if (id !== undefined) {
          server.close();
          resolve(id);
        } else {
          process.stdout.write("delivery had no source.userId — waiting for another\n");
        }
      } catch {
        process.stdout.write("delivery was not JSON — waiting for another\n");
      }
    });
  });
  server.listen(PORT, "127.0.0.1");
});

const tunnel = spawn(BIN, ["tunnel", "--url", `http://127.0.0.1:${PORT}`, "--no-autoupdate"], {
  stdio: ["ignore", "pipe", "pipe"],
});

/** cloudflared prints the assigned hostname to stderr, framed in a banner. */
const publicUrl = await new Promise<string>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("cloudflared did not report a URL")), 45_000);
  const scan = (chunk: Buffer) => {
    const found = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (found !== null) {
      clearTimeout(timer);
      resolve(found[0]);
    }
  };
  tunnel.stderr.on("data", scan);
  tunnel.stdout.on("data", scan);
});

process.stdout.write(
  [
    "",
    "Tunnel is up. Two steps, then this finishes on its own:",
    "",
    `  1. developers.line.biz → your channel → Messaging API → Webhook URL:`,
    `       ${publicUrl}/webhook`,
    "     Save it and turn Use webhook ON.",
    "",
    "  2. Send the bot any message from LINE on your phone.",
    "",
    "waiting for a delivery…",
    "",
  ].join("\n"),
);

const userId = await captured;
upsertEnv("LINE_TEST_USER_ID", userId);
tunnel.kill();

process.stdout.write(
  [
    "",
    `LINE_TEST_USER_ID=${userId}`,
    "",
    "Written to e2e/.env. Add the same value as a repository secret, then run:",
    "  pnpm --filter @theokit/gateway-e2e exec vitest run tests/line",
    "",
    "The tunnel is gone; the id is permanent, so this never needs running again.",
    "",
  ].join("\n"),
);
process.exit(0);
