import { describe, it, expect } from 'vitest'
import Stripe from 'stripe'
import { createStripeVerifier, verifyStripeSignature } from '../../src/verify/stripe.js'

// We use the official `stripe` SDK as a test oracle: it generates the
// signed header using Stripe's actual algorithm, and our verifier has to
// agree with it. If Stripe ever changes the scheme, the next time the
// stripe devDependency is bumped these tests will catch any drift.

const SECRET = 'whsec_test_secret_thatislongenoughtolooklikearealone'
const PAYLOAD = '{"id":"evt_test_webhook","type":"checkout.session.completed"}'

function signedHeader(payload: string, secret: string, timestampSeconds: number): string {
  // Stripe's TS types mark scheme/signature/cryptoProvider as required but
  // they're all optional at runtime. Cast through the parameter type to keep
  // strict TS happy without dropping to `any`.
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: timestampSeconds,
  } as Parameters<typeof Stripe.webhooks.generateTestHeaderString>[0])
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

// Freeze "now" so timestamp checks are deterministic.
const NOW_MS = 1_700_000_000_000
const NOW_S = Math.floor(NOW_MS / 1000)
const fixedNow = () => NOW_MS

describe('verifyStripeSignature - happy path', () => {
  it('returns valid for a correctly signed payload', () => {
    const header = signedHeader(PAYLOAD, SECRET, NOW_S)

    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(true)
    expect(result.code).toBe('valid')
    expect(result.provider).toBe('stripe')
  })

  it('verifies a payload signed just inside the default tolerance window', () => {
    const header = signedHeader(PAYLOAD, SECRET, NOW_S - 299)

    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(true)
  })

  it('respects a custom tolerance', () => {
    const header = signedHeader(PAYLOAD, SECRET, NOW_S - 60)

    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
      tolerance: 30,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('expired_timestamp')
  })

  it('agrees with Stripe SDK on a payload containing unicode', () => {
    const unicodePayload = '{"name":"日本語","emoji":"🚀"}'
    const header = signedHeader(unicodePayload, SECRET, NOW_S)

    const result = verifyStripeSignature({
      payload: unicodePayload,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(true)
  })
})

describe('verifyStripeSignature - missing_header', () => {
  it.each([undefined, null, ''])('returns missing_header for %s', (badHeader) => {
    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header: badHeader,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_header')
  })
})

describe('verifyStripeSignature - malformed_header', () => {
  it.each([
    'garbage',
    't=',
    'v1=abc',
    't=abc,v1=def',
    'v1=onlysig',
    't=1700000000',
    'random=value,other=thing',
  ])('returns malformed_header for %s', (badHeader) => {
    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header: badHeader,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('malformed_header')
  })
})

describe('verifyStripeSignature - expired_timestamp', () => {
  it('rejects a timestamp older than the default tolerance', () => {
    const header = signedHeader(PAYLOAD, SECRET, NOW_S - 301)

    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('expired_timestamp')
    expect(result.message).toMatch(/old|expired|drift/i)
  })

  it('rejects a wildly old timestamp', () => {
    const header = signedHeader(PAYLOAD, SECRET, NOW_S - 86_400)

    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('expired_timestamp')
  })
})

describe('verifyStripeSignature - signature_mismatch', () => {
  it('rejects a payload signed with a different secret', () => {
    const header = signedHeader(PAYLOAD, 'whsec_wrong_secret', NOW_S)

    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('signature_mismatch')
  })

  it('rejects a payload that has been tampered with after signing', () => {
    const header = signedHeader(PAYLOAD, SECRET, NOW_S)
    const tampered = PAYLOAD.replace('checkout.session.completed', 'invoice.paid')

    const result = verifyStripeSignature({
      payload: tampered,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('signature_mismatch')
  })
})

describe('verifyStripeSignature - body_mutated', () => {
  it('detects when the payload was prettified after signing', () => {
    // Stripe signs the raw bytes that come over the wire, which are minified.
    // If a framework parses + re-serializes with whitespace, the HMAC fails
    // even though the secret is correct. We surface this as body_mutated so
    // the user knows the secret is fine and they need to look at body parsing.
    const header = signedHeader(PAYLOAD, SECRET, NOW_S)
    const prettified = JSON.stringify(JSON.parse(PAYLOAD), null, 2)

    const result = verifyStripeSignature({
      payload: prettified,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('body_mutated')
  })
})

describe('verifyStripeSignature - cross-check against Stripe SDK', () => {
  // Hammer the verifier with a bunch of generated payloads, all signed by
  // the official SDK. Any divergence between our implementation and Stripe's
  // own signature scheme should make at least one of these fail.
  const payloads = [
    '{}',
    '{"a":1}',
    '{"nested":{"deeply":{"value":[1,2,3]}}}',
    JSON.stringify({ id: 'evt_1', amount: 1234, currency: 'usd' }),
    'plain text payload not even json',
    '   leading and trailing whitespace   ',
  ]

  it.each(payloads)('agrees with Stripe SDK for payload: %s', (payload) => {
    const header = signedHeader(payload, SECRET, NOW_S)

    const result = verifyStripeSignature({
      payload,
      header,
      secret: SECRET,
      now: fixedNow,
    })

    expect(result.valid).toBe(true)
  })
})

describe('verifyStripeSignature - real timestamp', () => {
  it('works against the actual current time when no now() is provided', () => {
    const header = signedHeader(PAYLOAD, SECRET, nowSeconds())

    const result = verifyStripeSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(true)
  })
})

describe('createStripeVerifier', () => {
  it('looks up the stripe-signature header case-insensitively', () => {
    const verifier = createStripeVerifier({ secret: SECRET })
    const header = signedHeader(PAYLOAD, SECRET, nowSeconds())

    const result = verifier.verify({
      body: PAYLOAD,
      headers: { 'Stripe-Signature': header },
    })

    expect(result.valid).toBe(true)
    expect(result.code).toBe('valid')
  })

  it('still returns missing_header when the signature header is absent', () => {
    const verifier = createStripeVerifier({ secret: SECRET })

    const result = verifier.verify({
      body: PAYLOAD,
      headers: {},
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_header')
  })
})
