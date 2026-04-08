import { describe, expect, it } from 'vitest'
import { getHeaderCaseInsensitive } from '../../src/verify/headers.js'

describe('getHeaderCaseInsensitive', () => {
  it('returns a header value for an exact-case match', () => {
    expect(getHeaderCaseInsensitive({ 'stripe-signature': 'sig' }, 'stripe-signature')).toBe('sig')
  })

  it('returns a header value for a mixed-case match', () => {
    expect(getHeaderCaseInsensitive({ 'Stripe-Signature': 'sig' }, 'stripe-signature')).toBe('sig')
  })

  it('returns undefined when the header is absent', () => {
    expect(getHeaderCaseInsensitive({}, 'stripe-signature')).toBeUndefined()
  })
})
