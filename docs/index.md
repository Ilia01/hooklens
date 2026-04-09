---
layout: home

hero:
  name: HookLens
  text: Inspect, verify, and replay webhooks
  tagline: Figure out why webhook signature verification failed before your framework hides the evidence.
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started
    - theme: alt
      text: Commands
      link: /commands/
    - theme: alt
      text: GitHub
      link: https://github.com/Ilia01/hooklens

features:
  - title: Capture the raw request
    details: HookLens listens on node:http directly, stores the original request body, and keeps the request shape intact for replay and inspection.
  - title: Diagnose signature failures
    details: Stripe and GitHub verification report specific failure codes like missing header, malformed header, expired timestamp, body mutation, and signature mismatch.
  - title: Replay without guesswork
    details: Stored events can be replayed to a new target after you change middleware, secrets, or handler logic. Forwarding preserves trusted target origin and base path behavior.
---

## What HookLens is for

Webhook failures are often annoying for one reason: the interesting part of the request is already gone by the time your application logs anything useful.

HookLens sits between the webhook provider and your app. It captures the request, verifies it, stores it locally, and can forward or replay it later.

## Core loop

```bash
hooklens listen --verify stripe --secret whsec_xxx --forward-to http://localhost:3000/webhook
hooklens list
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

## Current provider support

- Stripe
- GitHub

More providers can be added without changing the server or storage layers. The verifier seam is documented in [Adding Providers](/verification/adding-providers).
