import { describe, it, expect } from 'vitest'
import { sign } from '@octokit/webhooks-methods'
import { createGitHubVerifier, verifyGitHubSignature } from '../../src/verify/github.js'

// We use `@octokit/webhooks-methods` as a test oracle: its sign() function
// generates the same X-Hub-Signature-256 header that GitHub sends. If Octokit
// ever changes its algorithm, the next devDependency bump catches any drift.

const SECRET = 'github_test_secret_that_is_long_enough_to_look_real'
const PAYLOAD = '{"action":"opened","issue":{"number":1}}'

async function signPayload(secret: string, body: string): Promise<string> {
  return await sign(secret, body)
}

describe('verifyGitHubSignature - happy path', () => {
  it('returns valid for a correctly signed payload', async () => {
    const header = await signPayload(SECRET, PAYLOAD)

    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(true)
    expect(result.code).toBe('valid')
    expect(result.provider).toBe('github')
  })

  it('verifies a payload containing unicode', async () => {
    const unicodePayload = '{"name":"日本語","emoji":"🚀"}'
    const header = await signPayload(SECRET, unicodePayload)

    const result = verifyGitHubSignature({
      payload: unicodePayload,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(true)
  })

  it('verifies a non-JSON payload (plain text)', async () => {
    const plainText = 'just some plain text webhook body'
    const header = await signPayload(SECRET, plainText)

    const result = verifyGitHubSignature({
      payload: plainText,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(true)
  })

  it('verifies a non-JSON payload (form-encoded)', async () => {
    const formEncoded = 'action=opened&issue[number]=1&repo=hooklens'
    const header = await signPayload(SECRET, formEncoded)

    const result = verifyGitHubSignature({
      payload: formEncoded,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(true)
  })

  it('accepts an uppercase sha256 hex digest', async () => {
    const header = await signPayload(SECRET, PAYLOAD)
    const uppercaseDigest = `sha256=${header.slice('sha256='.length).toUpperCase()}`

    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header: uppercaseDigest,
      secret: SECRET,
    })

    expect(result.valid).toBe(true)
    expect(result.code).toBe('valid')
  })
})

describe('verifyGitHubSignature - missing_header', () => {
  it.each([undefined, null, ''])('returns missing_header for %s', (badHeader) => {
    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header: badHeader,
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_header')
  })
})

describe('verifyGitHubSignature - malformed_header', () => {
  it('rejects a header missing the sha256= prefix', () => {
    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header: 'abcdef1234567890',
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('malformed_header')
  })

  it('rejects an empty string after the sha256= prefix', () => {
    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header: 'sha256=',
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('malformed_header')
  })

  it('rejects a wrong algorithm prefix (sha1=)', () => {
    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header: 'sha1=abcdef1234567890',
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('malformed_header')
  })

  it('rejects a garbage string with no =', () => {
    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header: 'totalgarbage',
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('malformed_header')
  })

  it('rejects a non-hex digest after the sha256= prefix', () => {
    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header: 'sha256=not-a-hex-string!!!',
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('malformed_header')
    expect(result.message).toContain('invalid sha256 hex digest')
  })
})

describe('verifyGitHubSignature - signature_mismatch', () => {
  it('rejects a payload signed with a different secret', async () => {
    const header = await signPayload('wrong_secret', PAYLOAD)

    const result = verifyGitHubSignature({
      payload: PAYLOAD,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('signature_mismatch')
  })

  it('rejects a payload that has been tampered with after signing', async () => {
    const header = await signPayload(SECRET, PAYLOAD)
    const tampered = PAYLOAD.replace('opened', 'closed')

    const result = verifyGitHubSignature({
      payload: tampered,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('signature_mismatch')
  })
})

describe('verifyGitHubSignature - body_mutated', () => {
  it('detects when the payload was prettified after signing', async () => {
    const header = await signPayload(SECRET, PAYLOAD)
    const prettified = JSON.stringify(JSON.parse(PAYLOAD), null, 2)

    const result = verifyGitHubSignature({
      payload: prettified,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('body_mutated')
  })
})

describe('verifyGitHubSignature - cross-check against Octokit', () => {
  const payloads = [
    '{}',
    '{"a":1}',
    '{"nested":{"deeply":{"value":[1,2,3]}}}',
    JSON.stringify({ action: 'created', comment: { id: 42 } }),
    'plain text payload not even json',
    '   leading and trailing whitespace   ',
  ]

  it.each(payloads)('agrees with Octokit for payload: %s', async (payload) => {
    const header = await signPayload(SECRET, payload)

    const result = verifyGitHubSignature({
      payload,
      header,
      secret: SECRET,
    })

    expect(result.valid).toBe(true)
  })
})

describe('createGitHubVerifier', () => {
  it('returns a Verifier with provider github', () => {
    const verifier = createGitHubVerifier({ secret: SECRET })
    expect(verifier.provider).toBe('github')
    expect(typeof verifier.verify).toBe('function')
  })

  it('looks up x-hub-signature-256 header case-insensitively', async () => {
    const verifier = createGitHubVerifier({ secret: SECRET })
    const header = await signPayload(SECRET, PAYLOAD)

    const result = verifier.verify({
      body: PAYLOAD,
      headers: { 'X-Hub-Signature-256': header },
    })

    expect(result.valid).toBe(true)
    expect(result.code).toBe('valid')
  })

  it('returns missing_header when the signature header is absent', () => {
    const verifier = createGitHubVerifier({ secret: SECRET })

    const result = verifier.verify({
      body: PAYLOAD,
      headers: {},
    })

    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_header')
  })
})
