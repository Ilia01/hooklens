---
title: Debug Stripe webhook signature verification failed locally
description: Use HookLens to debug Stripe webhook signature verification failures caused by wrong secrets, missing headers, expired timestamps, or raw body mutation.
---

# Debug Stripe webhook signature verification failed locally

When Stripe says the webhook delivery succeeded but your app still fails signature verification, the problem is usually one of four things:

- the wrong signing secret
- a missing or malformed `stripe-signature` header
- an expired timestamp outside the tolerance window
- a mutated body because your framework parsed or re-serialized the request

HookLens is useful here because it captures the request before your app/framework parses it, verifies the Stripe signature itself, stores the event locally,
and lets you replay the delivery after you fix your app.

HookLens preserves the exact request bytes that Stripe signed and only derives UTF-8/JSON text for display.

## Start HookLens with Stripe verification

```bash
hooklens listen --port 4400 --verify stripe --secret whsec_xxx
```

Expose `127.0.0.1:4400` with your normal tunnel or provider CLI if Stripe needs a public callback URL.

## What HookLens can tell you

HookLens maps Stripe verification failures to concrete failure codes:

- `missing_header`: the `stripe-signature` header never reached your app
- `malformed_header`: the header was present but did not match Stripe's expected format
- `expired_timestamp`: the timestamp was outside the allowed verification window
- `signature_mismatch`: the header parsed, but the computed signature did not match
- `body_mutated`: the secret is likely correct, but the body bytes changed before verification

## A practical debugging loop

1. Run HookLens with your Stripe secret.
2. Trigger the webhook delivery through Stripe.
3. Check the HookLens output for `PASS` or `FAIL` and the reason.
4. If verification fails, run `hooklens list` to inspect the stored event metadata.
5. Fix the middleware, secret, or route handling in your app.
6. Replay the stored event:

```bash
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

## Common causes

### Wrong Stripe secret

The most common issue is using the wrong webhook signing secret for the endpoint you are testing. Make sure the secret passed to HookLens matches the
Stripe endpoint or CLI forwarder that produced the request.

### Missing or malformed `stripe-signature`

If HookLens reports `missing_header` or `malformed_header`, the request probably was not sent by Stripe, the header was stripped upstream, or you are
testing with a plain unsigned `curl` request.

### Expired timestamp

Stripe signs `timestamp.payload`. Replayed or delayed requests can fail if the timestamp falls outside the default tolerance window.

### Raw body mutation

If HookLens reports `body_mutated`, your app likely parsed JSON before verification and changed the signed bytes. Read
[Why raw body mutation breaks webhook verification](/verification/raw-body-mutation) for the underlying reason.

## Next step

If you are still narrowing down the exact cause, read the general [Verification](/verification/) reference or the raw body guide above.
