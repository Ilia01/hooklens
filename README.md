<div align="center">

<img src="https://ilia01.github.io/hooklens/logo.svg" alt="HookLens logo" width="88" height="88">

# HookLens

**Debug webhook signature failures locally.**

Figure out why webhook signature verification failed before your framework hides the evidence.

[Documentation](https://ilia01.github.io/hooklens/) · [npm](https://www.npmjs.com/package/hooklens) · [Latest release](https://github.com/Ilia01/hooklens/releases/latest) · [Contributing](./CONTRIBUTING.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Ilia01/hooklens/actions/workflows/ci.yml/badge.svg)](https://github.com/Ilia01/hooklens/actions/workflows/ci.yml)

</div>

---

HookLens is a local CLI for the annoying part of webhook debugging:
the delivery reached your app, verification still failed, and your framework already changed the body you needed to inspect.

It captures the incoming request before your app/framework parses it, verifies it locally, stores the event, and lets you replay the delivery after you fix your app.

> [!IMPORTANT]
> HookLens currently stores and replays webhook bodies through a UTF-8 text path. That matches the common Stripe/GitHub JSON case, but it is not yet byte-accurate raw-body preservation and replay for arbitrary payloads. Exact body-byte support is tracked in [#30](https://github.com/Ilia01/hooklens/issues/30).

<p align="center">
  <img src="https://ilia01.github.io/hooklens/hooklens-demo.gif" alt="HookLens demo showing capture, verification, listing, and replay from the terminal" width="980">
</p>

## Install

**Requires Node.js 24 or newer**.

```bash
npm install -g hooklens
```

## The loop

```bash
hooklens listen --verify github --secret ghsecret_xxx
hooklens list
hooklens inspect evt_abc123
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

Point your provider CLI, tunnel, or webhook source at `http://127.0.0.1:4400`.

Use HookLens when:

- the request reached your machine, but signature verification failed
- your framework parsed or re-serialized the body before verification
- you need the stored request and verification result, not a vague error line
- you want to replay the same event after changing middleware, secrets, or handler logic

It is not a tunnel, a hosted webhook inbox, or a replacement for provider delivery tooling.

## Read Next

- [Getting Started](https://ilia01.github.io/hooklens/getting-started) for installation and first capture
- [Commands](https://ilia01.github.io/hooklens/commands/) for the CLI reference
- [Verification](https://ilia01.github.io/hooklens/verification/) for failure codes and provider behavior
- [Stripe signature failures](https://ilia01.github.io/hooklens/verification/stripe-signature-failures)
- [GitHub signature mismatches](https://ilia01.github.io/hooklens/verification/github-signature-mismatch)
- [Raw body mutation](https://ilia01.github.io/hooklens/verification/raw-body-mutation)
- [Contributing](./CONTRIBUTING.md)

## License

[MIT](LICENSE)
