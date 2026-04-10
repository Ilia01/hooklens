import { afterEach, describe, expect, it, vi } from 'vitest'
import { runList } from '../../src/cli/list.js'
import * as storageModule from '../../src/storage/index.js'
import type { WebhookEvent } from '../../src/types.js'
import type { TerminalUI } from '../../src/ui/terminal.js'
import { defaultDbPath } from '../../src/storage/index.js'

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
    headers: {},
    body: '{}',
    ...overrides,
  }
}

function fakeStdout(): { write: ReturnType<typeof vi.fn>; written: () => string } {
  const chunks: string[] = []
  const write = vi.fn((chunk: string) => {
    chunks.push(chunk)
    return true
  })
  return { write, written: () => chunks.join('') }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runList', () => {
  it('loads events with the parsed limit and prints them', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const events = [makeEvent({ id: 'evt_2' }), makeEvent({ id: 'evt_1' })]

    storage.list.mockReturnValue(events)

    const createStorageMock = vi
      .spyOn(storageModule, 'createStorage')
      .mockReturnValue(storage as never)

    await runList({ limit: '2' }, { terminal })

    expect(createStorageMock).toHaveBeenCalledWith(defaultDbPath())
    expect(storage.list).toHaveBeenCalledWith(2)
    expect(terminal.printEventList).toHaveBeenCalledWith(events)
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('uses the default limit when none is provided', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runList({}, { terminal })

    expect(storage.list).toHaveBeenCalledWith(20)
    expect(terminal.printEventList).toHaveBeenCalledWith([])
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid limit values before opening storage', async () => {
    const createStorageMock = vi.spyOn(storageModule, 'createStorage')

    await expect(runList({ limit: 'nope' })).rejects.toThrow(/invalid limit/i)

    expect(createStorageMock).not.toHaveBeenCalled()
  })

  it('closes storage when listing fails', async () => {
    const storage = fakeStorage()

    storage.list.mockImplementation(() => {
      throw new Error('list failed')
    })

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await expect(runList({ limit: '5' }, { terminal: fakeTerminal() })).rejects.toThrow(
      'list failed',
    )

    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('outputs newline-delimited JSON when --json flag is set', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const stdout = fakeStdout()
    const events = [
      makeEvent({ id: 'evt_a', method: 'POST', path: '/hook' }),
      makeEvent({ id: 'evt_b', method: 'GET', path: '/ping' }),
    ]

    storage.list.mockReturnValue(events)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runList({ limit: '2', json: true }, { terminal, stdout })

    expect(terminal.printEventList).not.toHaveBeenCalled()

    const lines = stdout.written().trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({
      id: 'evt_a',
      timestamp: '2026-04-08T12:00:00.000Z',
      method: 'POST',
      path: '/hook',
    })
    expect(JSON.parse(lines[1])).toEqual({
      id: 'evt_b',
      timestamp: '2026-04-08T12:00:00.000Z',
      method: 'GET',
      path: '/ping',
    })
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('outputs nothing when --json is set and there are no events', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const stdout = fakeStdout()

    storage.list.mockReturnValue([])

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runList({ json: true }, { terminal, stdout })

    expect(stdout.write).not.toHaveBeenCalled()
    expect(terminal.printEventList).not.toHaveBeenCalled()
  })
})
