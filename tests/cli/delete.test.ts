import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDelete } from '../../src/cli/delete.js'
import * as storageModule from '../../src/storage/index.js'
import { defaultDbPath } from '../../src/storage/index.js'
import type { TerminalUI } from '../../src/ui/terminal.js'

interface FakeStorage {
  save: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

function fakeStorage(): FakeStorage {
  return {
    save: vi.fn(),
    load: vi.fn(),
    list: vi.fn(() => []),
    delete: vi.fn(() => false),
    clear: vi.fn(() => 0),
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
    printDeleted: vi.fn(),
    printCleared: vi.fn(),
    printListenStopped: vi.fn(),
    printError: vi.fn(),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runDelete', () => {
  it('deletes an existing event and prints confirmation', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    storage.delete.mockReturnValue(true)

    const createStorageMock = vi
      .spyOn(storageModule, 'createStorage')
      .mockReturnValue(storage as never)

    await runDelete('evt_abc123', { terminal })

    expect(createStorageMock).toHaveBeenCalledWith(defaultDbPath())
    expect(storage.delete).toHaveBeenCalledWith('evt_abc123')
    expect(terminal.printDeleted).toHaveBeenCalledWith('evt_abc123')
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('rejects when the event does not exist', async () => {
    const storage = fakeStorage()

    storage.delete.mockReturnValue(false)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await expect(runDelete('evt_missing', { terminal: fakeTerminal() })).rejects.toThrow(
      /evt_missing.*not found/i,
    )

    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('closes storage when delete throws', async () => {
    const storage = fakeStorage()

    storage.delete.mockImplementation(() => {
      throw new Error('db write failed')
    })

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await expect(runDelete('evt_test', { terminal: fakeTerminal() })).rejects.toThrow(
      'db write failed',
    )

    expect(storage.close).toHaveBeenCalledTimes(1)
  })
})
