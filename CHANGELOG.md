# Changelog

Workspace-level changes for the `theokit-gateways` monorepo. Per-package changes live in each package's `CHANGELOG.md`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Extracted `@theokit/gateway` + 10 platform adapters (telegram, discord, slack, whatsapp, teams, email, sms, line, matrix, mattermost) out of the `theokit-sdk` monorepo into this standalone repository (plan `monorepo-cohesion-split`, 2026-06-18), preserving full git history via `git filter-repo`. Every adapter now consumes `@theokit/sdk` as a published npm dependency (`^1.9.0`) instead of a workspace link; `@theokit/gateway` remains an in-repo workspace dependency. npm package names and versions are unchanged.
