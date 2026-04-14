import { z } from 'zod'

export const verificationResultSchema = z.object({
  valid: z.boolean(),
  provider: z.string(),
  message: z.string(),
  code: z.enum([
    'valid',
    'missing_header',
    'malformed_header',
    'expired_timestamp',
    'signature_mismatch',
    'body_mutated',
  ]),
})

export type VerificationResult = z.infer<typeof verificationResultSchema>

// A webhook event as it lives in memory and is exposed to the rest of the app.
// Headers are a parsed object here -- on disk they're stored as a JSON string.
// bodyRaw is the source of truth (exact wire bytes). bodyText is a best-effort
// UTF-8 decode (null when the bytes are not valid UTF-8). bodyExact is true when
// bodyRaw was captured from the wire, false when reconstructed from a legacy
// TEXT-only database row.
export const webhookEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  method: z.string(),
  path: z.string(),
  headers: z.record(z.string(), z.string()),
  bodyRaw: z.custom<Uint8Array>((value): value is Uint8Array => value instanceof Uint8Array),
  bodyText: z.string().nullable(),
  bodyExact: z.boolean(),
  verification: verificationResultSchema.nullable().optional(),
})

export type WebhookEvent = z.infer<typeof webhookEventSchema>

// The shape of a row read directly from the SQLite events table.
// headers is a JSON string at this layer; rowToEvent parses it.
export const eventRowSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  method: z.string(),
  path: z.string(),
  headers: z.string(),
  body: z.string().nullable().optional(),
  body_raw: z
    .custom<
      Uint8Array | null | undefined
    >((value): value is Uint8Array | null | undefined => value === null || value === undefined || value instanceof Uint8Array)
    .optional(),
  verification: z.string().nullable().optional(),
})

export type EventRow = z.infer<typeof eventRowSchema>

export const replayResultSchema = z.object({
  status: z.number().int(),
  body: z.string(),
})

export type ReplayResult = z.infer<typeof replayResultSchema>

/** Provider signature verifier. See CONTRIBUTING.md → Adding a provider. */
export interface Verifier {
  readonly provider: string
  verify(event: { headers: Record<string, string>; bodyRaw: Uint8Array }): VerificationResult
}

/**
 * Try to decode raw bytes as UTF-8. Returns the decoded string if the bytes
 * round-trip cleanly through encode/decode, or null if they don't (meaning the
 * payload contains invalid UTF-8 sequences).
 */
export function tryDecodeUtf8(raw: Uint8Array): string | null {
  if (raw.length === 0) return ''
  const buf = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)
  const decoded = buf.toString('utf8')
  const reEncoded = Buffer.from(decoded, 'utf8')
  if (buf.length !== reEncoded.length || !buf.equals(reEncoded)) return null
  return decoded
}
