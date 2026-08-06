# Changelog

Workspace-level changes for the `theokit-gateways` monorepo. Per-package changes live in each package's `CHANGELOG.md`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Wiki do repositório em `wiki/`, um bundle Open Knowledge Format v0.2 com 24 concepts: os dois ADRs, os registros de review e de release, o modelo de release, a iniciativa de architecture hardening, as cinco primitivas do core e os onze packages. (docs-reorg-2026-08)

### Changed

- O `TEST-PLAN.md` do exemplo `telegram-pro` deixa de citar um caminho absoluto do layout antigo (`/home/paulo/Projetos/usetheo/...`) e sinaliza que o arquivo de notas referenciado não existe mais. (docs-reorg-2026-08)
- O ADR-0001 passa a ser citado em `wiki/decisions/adr-0001-message-event-closed-union.md` no docstring de `MessageEvent` e no `ROADMAP.md`, no lugar do caminho antigo em `docs/adr/`. (docs-reorg-2026-08)

### Deprecated

### Removed

- `docs/`: os dois ADRs foram absorvidos por `wiki/decisions/` e o diretório foi removido. O conteúdo original segue recuperável no git em `c891696`. (docs-reorg-2026-08)

### Fixed

### Security

## [1.9.0] - 2026-07-10

### Added

- `@theokit/gateway` gains three new public primitives from the architecture-hardening effort: `chunkText` (boundary-preferring text chunker) and `chunkByGrapheme` (grapheme-safe chunker) — now the single source of the message-splitting logic the platform adapters share — plus `GatewayConfigurationError`, a shared base for per-adapter configuration errors. `HookExecutor` was relocated to its own module (public API unchanged). (roadmap M0/M1, arch-hardening)


### Changed

- Repointed the 4 duplicated `ConfigurationError` classes (`gateway-line`, `gateway-matrix`, `gateway-mattermost`, `gateway-sms`) to extend the shared core `GatewayConfigurationError` base. Name (`"ConfigurationError"`), message shape, `code`/`detail` fields, and `instanceof` are byte-identical (pinned by per-package `errors.test.ts` before/after); package-specific subclasses (`SDKNotInstalledError`, `BackendNotInstalledError`, `EncryptedRoomError`) stay local. Note: the audit report estimated 8 packages, but only these 4 actually defined the class — the other four `errors.ts` hold send-error mappers, not config errors (roadmap M2, arch-hardening). No public API or behavior change.
- Migrated the 6 duplicated message-splitting implementations (`gateway-slack`, `gateway-whatsapp`, `gateway-teams`, `gateway-discord`, `gateway-line`, `gateway-sms`) onto the shared core primitives `chunkText` / `chunkByGrapheme`. Each `splitForX` is now a thin, byte-identical wrapper (pinned by golden `split.test.ts` before/after); the surrogate/grapheme guard is single-sourced. `gateway-telegram`'s markdown-aware split stays deliberately separate (roadmap M1, arch-hardening). No public API or behavior change.
- Extracted `@theokit/gateway` + 10 platform adapters (telegram, discord, slack, whatsapp, teams, email, sms, line, matrix, mattermost) out of the `theokit-sdk` monorepo into this standalone repository (plan `monorepo-cohesion-split`, 2026-06-18), preserving full git history via `git filter-repo`. Every adapter now consumes `@theokit/sdk` as a published npm dependency (`^1.9.0`) instead of a workspace link; `@theokit/gateway` remains an in-repo workspace dependency. npm package names and versions are unchanged.

