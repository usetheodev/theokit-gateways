# theokit-gateways

Multi-channel gateway packages for the Theo ecosystem, extracted from `theokit-sdk` (2026-06-18, plan `monorepo-cohesion-split`) so the SDK stays a cohesive Agent-AI **Harness** while these platform adapters evolve on their own cadence.

## Packages

| Package | Platform |
| --- | --- |
| `@theokit/gateway` | Transport-agnostic core (BasePlatformAdapter, SessionRouter, DeliveryRouter, GatewayRunner). |
| `@theokit/gateway-telegram` | Telegram (grammy) |
| `@theokit/gateway-discord` | Discord (discord.js) |
| `@theokit/gateway-slack` | Slack (@slack/bolt) |
| `@theokit/gateway-whatsapp` | WhatsApp (Meta Cloud API + whatsapp-web.js) |
| `@theokit/gateway-teams` | Microsoft Teams |
| `@theokit/gateway-email` | Email (nodemailer + imapflow) |
| `@theokit/gateway-sms` | SMS (Twilio / Plivo / Vonage) |
| `@theokit/gateway-line` | LINE Messaging API |
| `@theokit/gateway-matrix` | Matrix |
| `@theokit/gateway-mattermost` | Mattermost |

## Relationship to `@theokit/sdk`

Every adapter consumes `@theokit/sdk` as a **published npm dependency** (`^1.9.0`). `@theokit/gateway` (the core) is an in-repo workspace dependency of the adapters.

## Develop

```bash
nvm use
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm build
pnpm test
```

## History

Extracted with full git history via `git filter-repo` from `usetheo/theokit-sdk`.
