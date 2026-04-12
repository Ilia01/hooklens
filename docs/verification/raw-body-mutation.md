---
title: Why raw body mutation breaks webhook verification
description: Learn why JSON parsing and re-serialization break webhook verification and how HookLens helps you catch raw body mutation locally.
---

# Why raw body mutation breaks webhook verification

Webhook providers sign raw bytes, not your parsed JavaScript object.

That distinction is the source of many "signature verification failed" bugs. The request reaches your app, JSON parsing succeeds, the payload looks
correct in logs, and verification still fails because the exact bytes changed before the signature check ran.

## What changed

These seemingly harmless transformations can change the signed payload:

- parsing JSON and re-serializing it
- changing whitespace or line endings
- changing key order during serialization
- reading the body stream too early and reconstructing it later

If the provider signed one byte sequence and your verifier checks another, the signature no longer matches.

## Why HookLens helps

HookLens captures the request before framework parsing and verifies against the body it received. In the current implementation that body is preserved through a UTF-8 text path, which is accurate for the common Stripe/GitHub JSON case but not yet byte-accurate raw-body storage/replay for arbitrary payloads. Exact byte preservation is tracked in [issue #30](https://github.com/Ilia01/hooklens/issues/30).

That means HookLens can already distinguish between:

- a bad secret
- a missing or malformed signature header
- a genuine signature mismatch
- a likely `body_mutated` case

That last case is the one most local logs fail to make obvious.

## Typical symptoms

You are probably dealing with raw body mutation if:

- the secret is correct
- the header looks valid
- the request payload looks fine in logs
- verification still fails after parsing middleware ran

## How to use HookLens to confirm it

Start HookLens with verification enabled for the provider you are testing:

```bash
hooklens listen --port 4400 --verify stripe --secret whsec_xxx
```

or:

```bash
hooklens listen --port 4400 --verify github --secret ghsecret_xxx
```

If HookLens reports `body_mutated`, the likely problem is not the provider's signature. It is your request handling path.

## What to fix in your app

The exact fix depends on the framework, but the principle is always the same:

1. read the raw request body first
2. verify the signature against those raw bytes
3. only then parse JSON or transform the payload

If you parse first and verify second, you are already too late.

## Related guides

- [Debug Stripe webhook signature verification failed locally](/verification/stripe-signature-failures)
- [Fix GitHub `x-hub-signature-256` mismatches locally](/verification/github-signature-mismatch)
