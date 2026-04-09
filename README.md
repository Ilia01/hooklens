<div align="center">

<img src="https://raw.githubusercontent.com/Ilia01/hooklens/main/docs/public/logo.svg" alt="HookLens logo" width="88" height="88">

# HookLens

**Inspect, verify, and replay webhooks from your terminal.**

Figure out why webhook signature verification failed before your framework hides the evidence.

[Documentation](https://ilia01.github.io/hooklens/) · [npm](https://www.npmjs.com/package/hooklens) · [Latest release](https://github.com/Ilia01/hooklens/releases/latest) · [Contributing](./CONTRIBUTING.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Ilia01/hooklens/actions/workflows/ci.yml/badge.svg)](https://github.com/Ilia01/hooklens/actions/workflows/ci.yml)

</div>

---

HookLens is an open-source CLI for local webhook debugging. It captures the raw request before your framework mutates it, verifies the signature, stores the event locally, and lets you replay or forward it while you fix your app.

## Install

**Requires Node.js 24 or newer**.

```bash
npm install -g hooklens
```

## Quick links

- [Getting Started](https://ilia01.github.io/hooklens/getting-started)
- [Commands](https://ilia01.github.io/hooklens/commands/)
- [Verification](https://ilia01.github.io/hooklens/verification/)
- [Forwarding](https://ilia01.github.io/hooklens/forwarding)
- [Architecture](https://ilia01.github.io/hooklens/architecture)

## Current provider support

- Stripe
- GitHub

## What it helps with

- Raw body mutation before signature verification
- Missing or malformed webhook signature headers
- Replaying captured events after middleware or secret changes
- Forwarding webhook traffic to a local target while keeping capture history

Detailed command usage, verification behavior, forwarding notes, and contributor guidance live in the docs and [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
