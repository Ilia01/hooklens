import { afterEach, describe, expect, it, vi } from 'vitest'
import { Writable } from 'node:stream'
import { runInspect } from '../../src/cli/inspect.js'
import * as storageModule from '../../src/storage/index.js'
import { defaultDbPath } from '../../src/storage/index.js'
import type { WebhookEvent } from '../../src/types.js'
import { fakeStorage, fakeTerminal } from '../helpers.js'

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
    ...overrides,
  }
}

function fakeStdout(): { stream: NodeJS.WritableStream; written: () => string } {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    },
  })
  return { stream, written: () => chunks.join('') }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runInspect', () => {
  it('loads an event and prints its full details', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const event = makeEvent()

    storage.load.mockReturnValue(event)

    const createStorageMock = vi
      .spyOn(storageModule, 'createStorage')
      .mockReturnValue(storage as never)

    await runInspect('evt_test', {}, { terminal })

    expect(createStorageMock).toHaveBeenCalledWith(defaultDbPath())
    expect(storage.load).toHaveBeenCalledWith('evt_test')
    expect(terminal.printEventDetail).toHaveBeenCalledWith(event)
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('rejects when the event does not exist', async () => {
    const storage = fakeStorage()

    storage.load.mockReturnValue(null)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await expect(runInspect('evt_missing', {}, { terminal: fakeTerminal() })).rejects.toThrow(
      /evt_missing.*not found/i,
    )

    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('outputs JSON when --json flag is set', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const stdout = fakeStdout()
    const event = makeEvent()

    storage.load.mockReturnValue(event)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runInspect('evt_test', { json: true }, { terminal, stdout: stdout.stream })

    expect(terminal.printEventDetail).not.toHaveBeenCalled()

    const parsed = JSON.parse(stdout.written().trim())
    expect(parsed).toEqual({
      ...event,
      bodyRaw: Buffer.from(event.bodyRaw).toString('base64'),
      body: event.bodyText,
    })
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('outputs JSON with verification when --json flag is set', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const stdout = fakeStdout()
    const verification = {
      valid: true,
      provider: 'github',
      message: 'signature matches',
      code: 'valid' as const,
    }
    const event = makeEvent({ verification })

    storage.load.mockReturnValue(event)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runInspect('evt_test', { json: true }, { terminal, stdout: stdout.stream })

    const parsed = JSON.parse(stdout.written().trim())
    expect(parsed.verification).toEqual(verification)
    expect(parsed.bodyRaw).toBe(Buffer.from(event.bodyRaw).toString('base64'))
    expect(parsed.body).toBe(event.bodyText)
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('emits binary-safe JSON when the stored body is not valid UTF-8', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const stdout = fakeStdout()
    const event = makeEvent({
      bodyRaw: Uint8Array.from([0x66, 0x6f, 0x80, 0x6f]),
      bodyText: null,
    })

    storage.load.mockReturnValue(event)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runInspect('evt_test', { json: true }, { terminal, stdout: stdout.stream })

    const parsed = JSON.parse(stdout.written().trim())
    expect(parsed.bodyRaw).toBe(Buffer.from(event.bodyRaw).toString('base64'))
    expect(parsed.bodyText).toBeNull()
    expect(parsed.body).toBeNull()
  })

  it('closes storage when load throws', async () => {
    const storage = fakeStorage()

    storage.load.mockImplementation(() => {
      throw new Error('db read failed')
    })

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await expect(runInspect('evt_test', {}, { terminal: fakeTerminal() })).rejects.toThrow(
      'db read failed',
    )

    expect(storage.close).toHaveBeenCalledTimes(1)
  })
})
