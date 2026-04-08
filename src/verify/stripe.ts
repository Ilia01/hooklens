import crypto from 'node:crypto'
import type { VerificationResult, Verifier } from '../types.js'
import { getHeaderCaseInsensitive } from './headers.js'

export interface VerifyStripeOptions {
  payload: string
  header: string | null | undefined
  secret: string
  tolerance?: number
  now?: () => number
}

const DEFAULT_TOLERANCE_SECONDS = 300
const PROVIDER = 'stripe'

interface ParsedHeader {
  timestamp: number
  signatures: string[]
}

function parseHeader(header: string): ParsedHeader | null {
  let timestamp: number | null = null
  const signatures: string[] = []

  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) return null

    const key = part.slice(0, eqIdx)
    const value = part.slice(eqIdx + 1)

    if (key === 't') {
      if (!/^\d+$/.test(value)) return null
      timestamp = Number(value)
    } else if (key === 'v1') {
      if (value.length === 0) return null
      signatures.push(value)
    }
  }

  if (timestamp === null || signatures.length === 0) return null
  return { timestamp, signatures }
}

function computeHmac(secret: string, signedPayload: string): string {
  return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
}

function constantTimeMatch(expected: string, candidates: string[]): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8')
  for (const candidate of candidates) {
    if (candidate.length !== expected.length) continue
    const candidateBuf = Buffer.from(candidate, 'utf8')
    if (crypto.timingSafeEqual(expectedBuf, candidateBuf)) return true
  }
  return false
}

function tryCanonicalForm(payload: string): string | null {
  try {
    const canonical = JSON.stringify(JSON.parse(payload))
    return canonical === payload ? null : canonical
  } catch {
    return null
  }
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

export function verifyStripeSignature(opts: VerifyStripeOptions): VerificationResult {
  if (!opts.header) {
    return failure(
      'missing_header',
      'stripe-signature header not found. Is this actually from Stripe?',
    )
  }

  const parsed = parseHeader(opts.header)
  if (!parsed) {
    return failure(
      'malformed_header',
      'stripe-signature header is malformed. Expected format: t=timestamp,v1=signature',
    )
  }

  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE_SECONDS
  const nowMs = (opts.now ?? Date.now)()
  const ageSeconds = Math.floor(nowMs / 1000) - parsed.timestamp

  if (ageSeconds > tolerance) {
    const minutes = Math.floor(ageSeconds / 60)
    return failure(
      'expired_timestamp',
      `Timestamp is ${minutes} minutes old. Event expired or your clock is drifting.`,
    )
  }

  const signedPayload = `${parsed.timestamp}.${opts.payload}`
  const expected = computeHmac(opts.secret, signedPayload)

  if (constantTimeMatch(expected, parsed.signatures)) {
    return success('Signature verified.')
  }

  const canonical = tryCanonicalForm(opts.payload)
  if (canonical !== null) {
    const expectedCanonical = computeHmac(opts.secret, `${parsed.timestamp}.${canonical}`)
    if (constantTimeMatch(expectedCanonical, parsed.signatures)) {
      return failure(
        'body_mutated',
        'Signature mismatch with correct secret. Body was likely parsed and re-serialized by your framework.',
      )
    }
  }

  return failure(
    'signature_mismatch',
    'Signature mismatch. Check your webhook secret matches the Stripe dashboard.',
  )
}

export interface StripeVerifierOptions {
  secret: string
  tolerance?: number
}

export function createStripeVerifier(opts: StripeVerifierOptions): Verifier {
  return {
    provider: PROVIDER,
    verify: (event) =>
      verifyStripeSignature({
        payload: event.body,
        header: getHeaderCaseInsensitive(event.headers, 'stripe-signature'),
        secret: opts.secret,
        tolerance: opts.tolerance,
      }),
  }
}
