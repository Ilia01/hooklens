import { afterEach, describe, expect, it, vi } from 'vitest'
import { runClear } from '../../src/cli/clear.js'
import * as storageModule from '../../src/storage/index.js'
import { defaultDbPath } from '../../src/storage/index.js'
import { fakeStorage, fakeTerminal } from '../helpers.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runClear', () => {
  it('clears all events with --yes flag and prints count', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    storage.clear.mockReturnValue(42)

    const createStorageMock = vi
      .spyOn(storageModule, 'createStorage')
      .mockReturnValue(storage as never)

    await runClear({ yes: true }, { terminal })

    expect(createStorageMock).toHaveBeenCalledWith(defaultDbPath())
    expect(storage.clear).toHaveBeenCalled()
    expect(terminal.printCleared).toHaveBeenCalledWith(42)
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('clears events when confirmation returns true', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const confirm = vi.fn().mockResolvedValue(true)

    storage.clear.mockReturnValue(5)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runClear({}, { terminal, confirm })

    expect(confirm).toHaveBeenCalled()
    expect(storage.clear).toHaveBeenCalled()
    expect(terminal.printCleared).toHaveBeenCalledWith(5)
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('aborts when confirmation returns false', async () => {
    const confirm = vi.fn().mockResolvedValue(false)
    const createStorageMock = vi.spyOn(storageModule, 'createStorage')

    await runClear({}, { terminal: fakeTerminal(), confirm })

    expect(confirm).toHaveBeenCalled()
    expect(createStorageMock).not.toHaveBeenCalled()
  })

  it('prints zero when no events exist', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    storage.clear.mockReturnValue(0)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await runClear({ yes: true }, { terminal })

    expect(terminal.printCleared).toHaveBeenCalledWith(0)
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('closes storage when clear throws', async () => {
    const storage = fakeStorage()

    storage.clear.mockImplementation(() => {
      throw new Error('db error')
    })

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    await expect(runClear({ yes: true }, { terminal: fakeTerminal() })).rejects.toThrow('db error')

    expect(storage.close).toHaveBeenCalledTimes(1)
  })
})
