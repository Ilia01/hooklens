---
title: Fix GitHub x-hub-signature-256 mismatches locally
description: Use HookLens to debug GitHub x-hub-signature-256 mismatches caused by wrong secrets, malformed headers, or raw body mutation.
---

# Fix GitHub `x-hub-signature-256` mismatches locally

GitHub signs the raw request body with HMAC-SHA256 and sends it in the `x-hub-signature-256` header. If that check fails in your app, the useful
question is not just "did it fail?" but "what exactly failed?"

HookLens answers that locally by capturing the raw request, validating GitHub's signature format, storing the event, and replaying the exact request
after you change your app.

## Start HookLens with GitHub verification

```bash
hooklens listen --port 4400 --verify github --secret ghsecret_xxx
```

Then point GitHub or your tunnel at `http://127.0.0.1:4400`.

## What HookLens checks

HookLens expects GitHub requests to include:

- the `x-hub-signature-256` header
- the `sha256=` prefix
- a 64-character hex digest

If any part of that is wrong, HookLens fails early and tells you whether the header was missing, malformed, or simply did not match the computed
digest.

## Common causes

### Wrong webhook secret

If the header format is valid but the computed digest does not match, the first thing to check is whether the secret in HookLens matches the GitHub
webhook secret configured on the repository or organization.

### Bad or stripped `x-hub-signature-256`

If HookLens reports `missing_header` or `malformed_header`, the request might not be a real GitHub delivery, or something upstream removed or rewrote
the header.

### Raw body mutation

GitHub signs the raw payload body, not parsed JSON. If middleware parsed and re-serialized the payload before verification, even whitespace or key
order changes can break the digest. That usually shows up as `body_mutated` in HookLens.

### Route or forwarding confusion

Sometimes the right request reaches the wrong local route or target. HookLens helps here because it stores the path, method, headers, and body before
you forward or replay the event.

## A practical debugging loop

1. Start HookLens with GitHub verification enabled.
2. Trigger or redeliver the GitHub webhook.
3. Check the HookLens output for the failure reason.
4. Run `hooklens inspect <event-id>` if you need the stored event details.
5. Fix your handler, secret, or middleware.
6. Replay the stored event to your local target:

```bash
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

## Next step

If the likely issue is parsed JSON or framework body handling, read [Why raw body mutation breaks webhook verification](/verification/raw-body-mutation).
