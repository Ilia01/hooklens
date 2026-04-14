# Fastify + Stripe

This example keeps the Stripe webhook route on `POST /webhook` and uses
`fastify-raw-body` so Stripe verification sees the exact request body before
Fastify or your own code turns it into something else.

## Install

```bash
npm install fastify fastify-raw-body stripe
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

- `fastify-raw-body` is registered before the route is declared
- the route opts into `rawBody: true`
- verification happens against `request.rawBody`
- JSON parsing happens only after verification succeeds

## File

- [server.mjs](./server.mjs)
