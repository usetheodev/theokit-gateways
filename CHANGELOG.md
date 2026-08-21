# Changelog

Changes to the repository itself — tooling, workflows and repository-wide sweeps.
Changes to a published package are recorded in that package's own changelog under
`packages/`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Test runs no longer claim every core on the host.** None of the 12 package configs capped `maxWorkers`, so vitest's default applied — `os.availableParallelism()`, one fork per core, each booting a full test environment. This repo's `test` script fans out across packages, so that default is paid once per package *concurrently*: measured on a 12-thread machine, pnpm runs 6 packages at a time, which is 72 CPU-bound forks on 12 cores. The cap now leaves 4 cores free (`Math.max(2, cpus().length - 4)`), which scales with the runner instead of hard-coding one machine's core count. It costs no wall-clock — measured in `theokit-ui`, the full suite ran 73.96s at 4 workers against 74.36s at 12, so the parallelism above the cap was already noise. (usetheokit/theokit-ui#51)

- The four actions in the release workflow are pinned by commit SHA instead of by ref. The job
  publishes as this organization, so a moving ref decides what runs in it. `changesets/action@v1`
  was the sharpest edge: `v1` is not a tag in that repository but a **branch** — the tag lookup
  returns 404 — so any push to it changed the code running with those credentials, with no release
  and no version bump to notice. Each pin carries the version it resolved to, read from the
  action's own tags. Majors are unchanged: this freezes what already runs rather than upgrading it.
