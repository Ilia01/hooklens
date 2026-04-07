<div align="center">

# HookLens

**Inspect, verify, and replay webhooks from your terminal.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Ilia01/hooklens/actions/workflows/ci.yml/badge.svg)](https://github.com/Ilia01/hooklens/actions/workflows/ci.yml)

</div>

> [!WARNING]
> HookLens is under active development and not yet published to npm. Star or watch the repo to get notified when the first release drops.

---

Every developer who's integrated Stripe, Paddle, or any webhook provider has hit the same wall: signature verification fails, the error says nothing useful, and you spend an hour staring at raw headers trying to figure out what went wrong.

HookLens sits between the webhook provider and your local server. It captures the raw request, verifies the signature, and tells you _why_ it failed -- not just "invalid signature" but the actual reason. Then it stores the event so you can replay it whenever you want.

## How it works

```bash
hooklens listen --verify stripe --secret whsec_xxx --forward-to http://localhost:3000/webhook
```

When a webhook arrives, HookLens:

1. Captures the raw body before any framework parses it
2. Verifies the provider signature and prints PASS or FAIL with a reason
3. Stores the event locally for replay
4. Forwards it to your app

Something break? Check what came in and replay it:

```bash
hooklens list
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

> [!IMPORTANT]
> HookLens is **not** a tunnel. You still need [ngrok](https://ngrok.com), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), or a similar tool to expose your local server to the internet. HookLens handles what happens after the request arrives.

## Why signature verification breaks

This is the problem HookLens exists to solve.

Webhook providers (Stripe, Paddle, GitHub, etc.) sign every request using the raw body. Your server is supposed to recompute that signature and compare. Simple in theory, but:

- **Express** parses the body into JSON before your route handler sees it. When you `JSON.stringify()` it back, key ordering or whitespace changes. Different string = different hash = verification fails.
- **Next.js** and **Fastify** do the same thing in different ways.
- The error you get? `"Webhook signature verification failed."` -- thanks for nothing.

HookLens intercepts the request at the HTTP level using `node:http` directly, before any framework touches the body. It verifies against the actual bytes that arrived over the wire, and when it fails, it tells you which of the 5 possible failure modes you hit:

| Failure           | What HookLens tells you                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Missing header    | `stripe-signature header not found. Is this actually from Stripe?`                                    |
| Wrong secret      | `Signature mismatch. Check your webhook secret matches the Stripe dashboard.`                         |
| Expired timestamp | `Timestamp is 47 minutes old. Event expired or your clock is drifting.`                               |
| Body mutated      | `Signature mismatch with correct secret. Body was likely parsed and re-serialized by your framework.` |
| Malformed header  | `stripe-signature header is malformed. Expected format: t=timestamp,v1=signature`                     |

## Install

> [!NOTE]
> Not on npm yet. For now, you can clone and build locally.

**Requires Node.js 24 or newer** (HookLens uses the built-in `node:sqlite` module).

```bash
git clone https://github.com/Ilia01/hooklens.git
cd hooklens
npm install
npm run build
npm link
```

## Commands

| Command                | Description              |
| ---------------------- | ------------------------ |
| `hooklens listen`      | Start receiving webhooks |
| `hooklens list`        | Show stored events       |
| `hooklens replay <id>` | Resend a stored event    |

### `hooklens listen`

```bash
hooklens listen --port 4400 --verify stripe --secret whsec_xxx --forward-to http://localhost:3000/webhook
```

| Flag                  | Default | Description                           |
| --------------------- | ------- | ------------------------------------- |
| `-p, --port <port>`   | `4400`  | Port to listen on                     |
| `--verify <provider>` | --      | Verify signatures (`stripe`)          |
| `--secret <secret>`   | --      | Webhook signing secret                |
| `--forward-to <url>`  | --      | Forward received webhooks to this URL |

### `hooklens list`

```bash
hooklens list --limit 10
```

| Flag                  | Default | Description              |
| --------------------- | ------- | ------------------------ |
| `-n, --limit <count>` | `20`    | Number of events to show |

### `hooklens replay`

```bash
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

| Flag         | Default                         | Description                     |
| ------------ | ------------------------------- | ------------------------------- |
| `--to <url>` | `http://localhost:3000/webhook` | Target URL to send the event to |

## Supported providers

- **Stripe** -- full signature verification with detailed failure messages

More providers will be added based on demand. [Open an issue](https://github.com/Ilia01/hooklens/issues) to request one.

## Contributing

Want to add a provider, fix a bug, or improve something? Here's how to get set up:

```bash
git clone https://github.com/Ilia01/hooklens.git
cd hooklens
npm install
npm run dev
```

`npm run dev` watches for changes and rebuilds automatically. You can test your changes by running `hooklens` commands directly against the local build.

Please open an issue before starting work on anything significant so we can discuss the approach.

When you're ready to submit, make sure CI will be happy:

```bash
npm test
npm run typecheck
npm run lint
```

## License

[MIT](LICENSE)
