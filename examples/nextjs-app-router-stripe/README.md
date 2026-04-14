# Next.js App Router + Stripe

This example keeps the Stripe webhook route on `POST /api/webhook` and uses
`await req.text()` so Stripe verification sees the exact request body before any
JSON parsing happens.

## Install

In a Next.js App Router project:

```bash
npm install stripe
```

Copy [app/api/webhook/route.ts](./app/api/webhook/route.ts) into your app.

## Run the app

Set your Stripe webhook secret and start Next.js:

```bash
export STRIPE_WEBHOOK_SECRET=whsec_xxx
npm run dev
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
stripe listen --forward-to http://127.0.0.1:4400/api/webhook
stripe trigger checkout.session.completed
```

## Why this shape works

- App Router uses the standard `Request` API
- `await req.text()` reads the exact request body first
- verification happens before `JSON.parse()`
- there is no Pages Router `bodyParser` config involved here

## File

- [app/api/webhook/route.ts](./app/api/webhook/route.ts)
