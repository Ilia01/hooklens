import { describe, expect, it } from 'vitest'
import { buildVerifier } from '../../src/cli/listen.js'

describe('buildVerifier', () => {
  it('returns undefined when --verify is not set', () => {
    expect(buildVerifier({})).toBeUndefined()
    expect(buildVerifier({ secret: 'whsec_xxx' })).toBeUndefined()
  })

  it('returns a stripe Verifier when --verify=stripe and --secret are both set', () => {
    const verifier = buildVerifier({ verify: 'stripe', secret: 'whsec_xxx' })
    expect(verifier).toBeDefined()
    expect(verifier?.provider).toBe('stripe')
    expect(typeof verifier?.verify).toBe('function')
  })

  it('throws when --verify=stripe is set without --secret', () => {
    expect(() => buildVerifier({ verify: 'stripe' })).toThrow(/secret/i)
  })

  it('throws on an unknown provider with a helpful message', () => {
    expect(() => buildVerifier({ verify: 'github', secret: 'x' })).toThrow(/unknown.*github/i)
  })

  it('produces a Verifier whose verify() actually returns a result', () => {
    // Round-trip: build it from flags, then call verify and confirm we get
    // a real VerificationResult back. This is the "verify the verifier" check.
    const verifier = buildVerifier({ verify: 'stripe', secret: 'whsec_xxx' })
    const result = verifier?.verify({
      headers: {},
      body: '{}',
    })
    expect(result).toBeDefined()
    expect(result?.provider).toBe('stripe')
    // No header was passed, so this should land on missing_header
    expect(result?.code).toBe('missing_header')
  })
})
