# Verification

HookLens currently supports provider-specific verification for Stripe and GitHub.

Use this section when the request reached your app, but verification still failed and you need to know whether the problem is the header, the secret,
the timestamp, or the raw body itself.

Current limitation: HookLens currently preserves webhook bodies through a UTF-8 text path. That is accurate for the common Stripe/GitHub JSON case, but not yet exact body-byte preservation/replay for arbitrary payloads. Byte-accurate raw-body support is tracked in [issue #30](https://github.com/Ilia01/hooklens/issues/30).

## Start with the problem you have

- [Debug Stripe webhook signature verification failed locally](/verification/stripe-signature-failures)
- [Fix GitHub `x-hub-signature-256` mismatches locally](/verification/github-signature-mismatch)
- [Why raw body mutation breaks webhook verification](/verification/raw-body-mutation)

## Supported providers

| Provider | Header                | Signature shape                 |
| -------- | --------------------- | ------------------------------- |
| Stripe   | `stripe-signature`    | `t=<timestamp>,v1=<hex digest>` |
| GitHub   | `x-hub-signature-256` | `sha256=<64-char hex digest>`   |

Header lookup is case-insensitive in both verifiers.

## Failure codes

These codes drive the CLI output and are shared across verifiers where possible.

| Code                 | Meaning                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `valid`              | Signature verified successfully                                         |
| `missing_header`     | Expected provider header was missing                                    |
| `malformed_header`   | Header existed but did not match the expected format                    |
| `expired_timestamp`  | Timestamp-based verification window was exceeded                        |
| `signature_mismatch` | Header parsed, but the computed signature did not match                 |
| `body_mutated`       | The secret is correct, but the body was likely parsed and re-serialized |

## Stripe details

Stripe signs `timestamp.payload`, not just the raw payload. HookLens:

- parses `t=` and one or more `v1=` signatures
- applies a default 5-minute tolerance window
- compares against every candidate signature in the header
- retries against a canonicalized form to detect body mutation

## GitHub details

GitHub signs the raw payload body with HMAC-SHA256 and sends the digest as `sha256=<hex>`.

HookLens:

- requires the `sha256=` prefix
- validates the digest as exactly 64 hex characters
- rejects malformed digests before doing comparison work
- retries against a canonicalized form to detect body mutation

## Why body mutation matters

The raw body is the signed input. If your framework parses JSON and later re-serializes it, insignificant-looking differences like whitespace or key order can change the payload bytes and break verification.

That is why HookLens captures the request before framework parsing and why the `body_mutated` result exists. Today that capture path is UTF-8 text-first; byte-accurate raw-body preservation is the next step tracked in [issue #30](https://github.com/Ilia01/hooklens/issues/30).

## Next step

If you want to extend HookLens with another verifier, see [Add a verification provider](/verification/adding-providers).
