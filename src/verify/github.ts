import crypto from 'node:crypto'
import type { VerificationResult, Verifier } from '../types.js'
import { getHeaderCaseInsensitive, tryCanonicalForm } from './headers.js'

export interface VerifyGitHubOptions {
  payload: string | Uint8Array
  header: string | null | undefined
  secret: string
}

const PROVIDER = 'github'
const PREFIX = 'sha256='
const SHA256_HEX = /^[0-9a-fA-F]{64}$/

function computeHmac(
  secret: VerifyGitHubOptions['secret'],
  payload: VerifyGitHubOptions['payload'],
): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function constantTimeMatch(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false
  const expectedBuf = Buffer.from(expected, 'utf8')
  const actualBuf = Buffer.from(actual, 'utf8')
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}

function success(message: string): VerificationResult {
  return { valid: true, provider: PROVIDER, code: 'valid', message }
}

function failure(
  code: Exclude<VerificationResult['code'], 'valid'>,
  message: string,
): VerificationResult {
  return { valid: false, provider: PROVIDER, code, message }
}

export function verifyGitHubSignature(opts: VerifyGitHubOptions): VerificationResult {
  if (!opts.header) {
    return failure(
      'missing_header',
      'x-hub-signature-256 header not found. Is this actually from GitHub?',
    )
  }

  if (!opts.header.startsWith(PREFIX)) {
    return failure('malformed_header', 'x-hub-signature-256 header must start with sha256=')
  }

  const signature = opts.header.slice(PREFIX.length)
  if (signature.length === 0) {
    return failure('malformed_header', 'x-hub-signature-256 header has no signature after sha256=')
  }

  if (!SHA256_HEX.test(signature)) {
    return failure('malformed_header', 'x-hub-signature-256 header has invalid sha256 hex digest')
  }

  const normalizedSignature = signature.toLowerCase()
  const expected = computeHmac(opts.secret, opts.payload)

  if (constantTimeMatch(expected, normalizedSignature)) {
    return success('Signature verified.')
  }

  const canonical = tryCanonicalForm(opts.payload)
  if (canonical !== null) {
    const expectedCanonical = computeHmac(opts.secret, canonical)
    if (constantTimeMatch(expectedCanonical, normalizedSignature)) {
      return failure(
        'body_mutated',
        'Signature mismatch with correct secret. Body was likely parsed and re-serialized by your framework.',
      )
    }
  }

  return failure(
    'signature_mismatch',
    'Signature mismatch. Check your webhook secret matches the GitHub settings.',
  )
}

export function createGitHubVerifier(opts: { secret: string }): Verifier {
  return {
    provider: PROVIDER,
    verify: (event) =>
      verifyGitHubSignature({
        payload: event.bodyRaw,
        header: getHeaderCaseInsensitive(event.headers, 'x-hub-signature-256'),
        secret: opts.secret,
      }),
  }
}
