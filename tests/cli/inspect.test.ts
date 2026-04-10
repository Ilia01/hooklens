import { afterEach, describe, expect, it, vi } from 'vitest'
import { Writable } from 'node:stream'
import { runInspect } from '../../src/cli/inspect.js'
import * as storageModule from '../../src/storage/index.js'
import { defaultDbPath } from '../../src/storage/index.js'
import type { WebhookEvent } from '../../src/types.js'
import type { TerminalUI } from '../../src/ui/terminal.js'

interface FakeStorage {
  save: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

function fakeStorage(): FakeStorage {
  return {
    save: vi.fn(),
    load: vi.fn(),
    list: vi.fn(() => []),
    clear: vi.fn(),
    close: vi.fn(),
  }
}

function fakeTerminal(): TerminalUI {
  return {
    printListenStarted: vi.fn(),
    printEventCaptured: vi.fn(),
    printForwardError: vi.fn(),
    printEventList: vi.fn(),
    printEventDetail: vi.fn(),
    printReplayResult: vi.fn(),
    printListenStopped: vi.fn(),
    printError: vi.fn(),
  }
}

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: 'evt_test',
    timestamp: '2026-04-08T12:00:00.000Z',
    method: 'POST',
    path: '/webhook',
    headers: { 'content-type': 'application/json' },
    body: '{"ok":true}',
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
    expect(parsed).toEqual(event)
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
    expect(storage.close).toHaveBeenCalledTimes(1)
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
