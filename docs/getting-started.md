# Getting Started

HookLens is a local CLI for receiving, verifying, storing, and replaying webhooks.

## Requirements

- Node.js 24 or newer
- A tunnel such as ngrok or Cloudflare Tunnel if you want to receive webhooks from the public internet

> [!IMPORTANT]
> HookLens is not a tunnel. It binds to `127.0.0.1` and expects you to expose that local port yourself if the provider needs a public callback URL.

## Install

```bash
npm install -g hooklens
```

## First capture

Start a local listener:

```bash
hooklens listen --port 4400
```

Send it a request from another terminal:

```bash
curl -X POST http://127.0.0.1:4400/test \
  -H 'content-type: application/json' \
  -d '{"ok":true}'
```

You should see HookLens print a `RECV` line for the captured event.

> [!NOTE]
> This first request example is for plain capture mode only. If you start HookLens with `--verify stripe` or `--verify github`, the same unsigned `curl` request will print `FAIL` because it is missing the provider signature header.

## Inspect what was stored

```bash
hooklens list
```

This prints recent event IDs, timestamps, methods, and paths from the local SQLite store at `~/.hooklens/events.db`.

## Replay the event

```bash
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

The replay command loads the stored event and re-sends its original method, headers, and body to the target URL.

## Turn on verification

Stripe:

```bash
hooklens listen --verify stripe --secret whsec_xxx
```

GitHub:

```bash
hooklens listen --verify github --secret ghsecret_xxx
```

When verification is enabled, HookLens prints `PASS` or `FAIL` with a specific reason instead of a generic signature error.

For example, if you run:

```bash
hooklens listen --verify stripe --secret whsec_xxx
```

and then send the unsigned `curl` example from above, HookLens will print a `FAIL` line with `stripe-signature header not found`. That is expected because the request did not come from Stripe.

## Turn on forwarding

```bash
hooklens listen \
  --verify stripe \
  --secret whsec_xxx \
  --forward-to http://localhost:3000/webhook
```

Forwarding lets HookLens verify and store the request before sending it on to your app.
