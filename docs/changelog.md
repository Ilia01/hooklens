# Changelog

## v1.0.1

Released on April 11, 2026.

Highlights:

- refreshed the docs homepage and README around webhook signature failure debugging
- added provider-specific verification guides for Stripe, GitHub, and raw body mutation
- documented the current CLI/runtime helper patterns and docs contribution workflow
- fixed the CLI version output to read from `package.json`
- tightened npm package metadata for the docs site and search surfaces

Release:

- [GitHub release v1.0.1](https://github.com/Ilia01/hooklens/releases/tag/v1.0.1)

## v1.0.0

Released on April 10, 2026.

First stable release.

- `inspect` command to view full event details
- `delete` and `clear` commands for managing stored events
- `--json` flag for machine-readable output on `list`, `inspect`, and `replay`
- forward retry with exponential backoff (`--retry`)
- cap on forwarded response body size
- VitePress docs site with demo GIF

Release:

- [GitHub release v1.0.0](https://github.com/Ilia01/hooklens/releases/tag/v1.0.0)

## v0.2.0

Released on April 9, 2026.

Highlights:

- added GitHub webhook verification
- improved forward error logging
- added CLI help examples for provider usage
- hardened GitHub verifier handling for malformed digests

Release:

- [GitHub release v0.2.0](https://github.com/Ilia01/hooklens/releases/tag/v0.2.0)

## v0.1.1

Released on April 8, 2026.

Highlights:

- updated install docs for the npm package
- finalized the automated release workflow

Release:

- [GitHub release v0.1.1](https://github.com/Ilia01/hooklens/releases/tag/v0.1.1)

## v0.1.0

First public npm release.

Highlights:

- local webhook capture server
- Stripe signature verification
- SQLite-backed event storage
- `listen`, `list`, and `replay` commands

There is no GitHub release object for `v0.1.0` because that initial publish happened before the release workflow was in place.
