---
title: Add a verification provider
description: Extend HookLens with a new provider-specific verifier and wire it into the CLI and docs.
---

# Add a verification provider

HookLens keeps provider-specific verification behind a small seam.

## The contract

Every provider implements `Verifier` from `src/types.ts`:

```ts
interface Verifier {
  readonly provider: string
  verify(event: { headers: Record<string, string>; body: string }): VerificationResult
}
```

The server does not know anything about Stripe, GitHub, or future providers. It just calls `verify()`.

## What a provider needs

1. Verification logic in `src/verify/<provider>.ts`
2. Tests in `tests/verify/<provider>.test.ts`
3. CLI wiring in `buildVerifier()` inside `src/cli/listen.ts`

Nothing else should need to change.

## Reference shape

Current providers:

- `src/verify/stripe.ts`
- `src/verify/github.ts`

Each exports:

- a provider-specific `verify...Signature(...)` primitive
- a `create...Verifier(...)` factory that returns a `Verifier`

## Result codes

Stick to the existing `VerificationResult.code` values when you can:

- `valid`
- `missing_header`
- `malformed_header`
- `expired_timestamp`
- `signature_mismatch`
- `body_mutated`

If a provider has a genuinely different failure mode, add it to `verificationResultSchema` in `src/types.ts` and update terminal output to match.

## Test guidance

- Prefer the provider's official SDK or reference implementation as a test oracle when available
- Cover happy path, missing header, malformed header, mismatch, and body mutation when the provider makes that possible
- Keep provider-specific parsing logic in the provider module, not in the server

## CLI wiring

`hooklens listen --verify <provider> --secret ...` goes through `buildVerifier()`.

That is the only place where provider names should be mapped to factories.
