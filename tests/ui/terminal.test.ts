import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createTerminal } from '../../src/ui/terminal.js'
import type { WebhookEvent } from '../../src/types.js'

function captureStream(): { stream: NodeJS.WriteStream; written: () => string } {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    },
  })
  return { stream: stream as NodeJS.WriteStream, written: () => chunks.join('') }
}

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  const bodyText = '{"ok":true}'
  return {
    id: 'evt_test',
    timestamp: '2026-04-08T12:00:00.000Z',
    method: 'POST',
    path: '/webhook',
    headers: { 'content-type': 'application/json' },
    bodyRaw: Buffer.from(bodyText, 'utf8'),
    bodyText,
    bodyExact: true,
    verification: null,
    ...overrides,
  }
}

describe('createTerminal', () => {
  it('prints a binary fallback when bodyText is null', () => {
    const stdout = captureStream()
    const terminal = createTerminal(stdout.stream, stdout.stream)
    const event = makeEvent({
      bodyRaw: Uint8Array.from([0x66, 0x6f, 0x80, 0x6f]),
      bodyText: null,
    })

    terminal.printEventDetail(event)

    const written = stdout.written()
    expect(written).toContain('<binary body: 4 bytes>')
    expect(written).toContain('666f806f')
  })
})
