import { z } from 'zod'

// A webhook event as it lives in memory and is exposed to the rest of the app.
// Headers are a parsed object here -- on disk they're stored as a JSON string.
export const webhookEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  method: z.string(),
  path: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
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
  body: z.string(),
})

export type EventRow = z.infer<typeof eventRowSchema>

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

/** Provider signature verifier. See CONTRIBUTING.md → Adding a provider. */
export interface Verifier {
  readonly provider: string
  verify(event: { headers: Record<string, string>; body: string }): VerificationResult
}
