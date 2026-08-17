# `@theokit/gateway-e2e`

Live tests. Real credentials, real APIs, real messages.

The unit suites in `packages/*/tests` prove this code does what we think against
fakes. They cannot prove the thing that actually breaks in production: that the
contract we coded against is still the contract the platform serves. A fake
agrees with whoever wrote it. Only LINE can tell you that `replyMessage` now
takes one object instead of two arguments — which is exactly how every outbound
LINE message shipped broken while eight unit tests stayed green.

That is what lives here, and nothing else. These suites do not re-test splitting
or filtering over the wire; they test **auth reaches the provider**, **our
payload shape is accepted**, and **a real error maps to the error we claim to
return**.

---

## Running

```bash
cp e2e/.env.example e2e/.env     # then fill in what you have
pnpm e2e                         # or: pnpm --filter @theokit/gateway-e2e e2e
pnpm e2e:readiness               # what is configured, what each gap needs
```

Nothing runs without `E2E_LIVE=1`. A stray `pnpm e2e` cannot spend money or post
into a chat.

**`pnpm test` never runs these.** This package deliberately has no `test`
script, so `pnpm -r run test` — the command CI runs on every push — cannot reach
it. Live tests belong on a schedule and on demand, not on every pull request:
they are slow, they cost money, and a provider's bad afternoon is not a reason to
turn someone's PR red.

---

## What each platform needs

`pnpm e2e:readiness` prints this from the registry, per platform, with the
console path to create each credential. It is generated, so it cannot drift from
what the code reads.

`.env.example` is generated from the same source:

```bash
pnpm --filter @theokit/gateway-e2e env:example
```

---

## Two kinds of platform, and why it decides what is testable

This is the distinction the folder layout and the harness are built around.

**Connection-based** — Telegram, Discord, Slack, Matrix, Mattermost, Email.
The bot dials out and holds the socket open (long-polling, a gateway websocket,
socket mode, sync, IMAP IDLE). Inbound arrives on a connection *we* opened, so a
full send-then-receive round trip runs anywhere, including CI, with no public URL
and no firewall change.

**Webhook-based** — LINE, Teams, WhatsApp Cloud, SMS.
The *platform* dials in, to a URL it has to be able to reach. Outbound and
credential checks run anywhere. **Inbound cannot**, without a publicly reachable
HTTPS endpoint. Those suites skip and say so, rather than serving themselves a
request locally and calling it coverage — a locally-served request proves the
test's own fixture works and nothing about the platform.

To run the webhook inbound suites, point `E2E_PUBLIC_URL` at a tunnel that
reaches this process (`ngrok http 3000`, `cloudflared tunnel`), and register that
URL in the provider console.

---

## Layout

```
e2e/
├── src/
│   ├── platforms.ts     the registry — every credential, what it is, where to get it
│   ├── credentials.ts   .env locally, repository secrets in CI; identical names
│   └── harness.ts       describeLive() — skips with a NAMED reason, never silently
├── tests/
│   ├── readiness.test.ts   always runs; reports the gap across all ten
│   └── <platform>/         one directory per registry id
└── scripts/
    ├── env-example.ts        regenerates .env.example from the registry
    └── discover-telegram.ts  finds a chat id the bot can see
```

One directory per platform id, and `readiness.test.ts` fails if those two ever
disagree — a platform in the registry with no suite, or a suite for a platform
nobody registered.

---

## Rules these tests follow

**Skips are loud.** Vitest reports a skipped test and a passing test with the
same absence of red. Every skip here names the exact variable that was missing,
because "9 skipped, 1 passed" otherwise reads at a glance like ten platforms
passing.

**Targets are throwaway.** Every `*_TEST_*` variable must point at a chat,
channel, room or number created for this and nothing else. A credential says who
you are; a target says where it is safe to write. They are separate fields in the
registry for that reason.

**Messages are marked.** Everything sent carries a run marker, so anything that
escapes into a real conversation is identifiable as test traffic at a glance.

**No retries.** `retry: 0`. A live suite that retries hides an intermittent
contract break, which is the one thing these tests exist to catch.

**One platform at a time.** `fileParallelism: false`. Parallel files race for the
same test chat and interleave their messages, and a shared rate limit turns that
into flakiness that looks like a product bug.

**Credential values are never printed.** The readiness report answers set or
not-set, never the value, and there is a test asserting it stays that way.

---

## Adding a platform

1. Create the credentials; `pnpm e2e:readiness` tells you which and where.
2. Put them in `e2e/.env`, and add them as repository secrets for CI.
3. Write `tests/<id>/live.test.ts`. Start from `tests/telegram/live.test.ts` —
   auth, outbound, error mapping, then inbound if the transport allows it.
4. **Run it against the real API before committing.** A live test that has never
   made a live call is a unit test with extra latency, and this repository has
   just spent a cycle removing tests that only looked like coverage.
