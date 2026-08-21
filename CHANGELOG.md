# Changelog

Changes to the repository itself — tooling, workflows and repository-wide sweeps.
Changes to a published package are recorded in that package's own changelog under
`packages/`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The four actions in the release workflow are pinned by commit SHA instead of by ref. The job
  publishes as this organization, so a moving ref decides what runs in it. `changesets/action@v1`
  was the sharpest edge: `v1` is not a tag in that repository but a **branch** — the tag lookup
  returns 404 — so any push to it changed the code running with those credentials, with no release
  and no version bump to notice. Each pin carries the version it resolved to, read from the
  action's own tags. Majors are unchanged: this freezes what already runs rather than upgrading it.
