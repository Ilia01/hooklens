# Express + Stripe

This example keeps the Stripe webhook route on `POST /webhook` and uses
`express.raw()` so the webhook verifier sees the exact request body first.

## Install

```bash
npm install express stripe
```

## Run the app

Set your Stripe webhook secret in the shell, then start the server:

```bash
export STRIPE_WEBHOOK_SECRET=whsec_xxx
node server.mjs
```

The app listens on `http://localhost:3000`.

## Put HookLens in front of it

```bash
hooklens listen \
  --port 4400 \
  --verify stripe \
  --secret "$STRIPE_WEBHOOK_SECRET" \
  --forward-to http://localhost:3000
```

## Point Stripe CLI at HookLens

```bash
stripe listen --forward-to http://127.0.0.1:4400/webhook
stripe trigger checkout.session.completed
```

## Why this shape works

- the webhook route uses `express.raw()` instead of `express.json()`
- verification happens against `req.body` while it is still a `Buffer`
- JSON parsing happens only after verification succeeds

## File

- [server.mjs](./server.mjs)
