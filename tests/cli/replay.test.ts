import { afterEach, describe, expect, it, vi } from 'vitest'
import { Writable } from 'node:stream'
import { runReplay } from '../../src/cli/replay.js'
import * as serverModule from '../../src/server/index.js'
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

describe('runReplay', () => {
  it('loads an event, forwards it, and prints the replay result', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const event = makeEvent()
    const longBody = 'x'.repeat(210)

    storage.load.mockReturnValue(event)

    const createStorageMock = vi
      .spyOn(storageModule, 'createStorage')
      .mockReturnValue(storage as never)

    const forwardEventMock = vi.spyOn(serverModule, 'forwardEvent').mockResolvedValue({
      status: 202,
      body: longBody,
    })

    await runReplay('evt_test', {}, { terminal })

    expect(createStorageMock).toHaveBeenCalledWith(defaultDbPath())
    expect(storage.load).toHaveBeenCalledWith('evt_test')
    expect(forwardEventMock).toHaveBeenCalledWith('http://localhost:3000/webhook', event)
    expect(terminal.printReplayResult).toHaveBeenCalledWith({
      status: 202,
      body: `${'x'.repeat(197)}...`,
    })
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('rejects when the event does not exist', async () => {
    const storage = fakeStorage()

    storage.load.mockReturnValue(null)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    const forwardEventMock = vi.spyOn(serverModule, 'forwardEvent')

    await expect(runReplay('evt_missing', {}, { terminal: fakeTerminal() })).rejects.toThrow(
      /evt_missing.*not found/i,
    )

    expect(forwardEventMock).not.toHaveBeenCalled()
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid target URLs before opening storage', async () => {
    const createStorageMock = vi.spyOn(storageModule, 'createStorage')

    await expect(runReplay('evt_test', { to: 'not a url' })).rejects.toThrow(/invalid.*url/i)

    expect(createStorageMock).not.toHaveBeenCalled()
  })

  it('surfaces forward failures as actionable replay errors', async () => {
    const storage = fakeStorage()
    const event = makeEvent()

    storage.load.mockReturnValue(event)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    vi.spyOn(serverModule, 'forwardEvent').mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:3000'),
    )

    await expect(
      runReplay('evt_test', { to: 'http://127.0.0.1:3000/webhook' }, { terminal: fakeTerminal() }),
    ).rejects.toThrow(/failed to replay.*econnrefused/i)
  })

  it('closes storage when forwarding throws', async () => {
    const storage = fakeStorage()
    const event = makeEvent()

    storage.load.mockReturnValue(event)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    vi.spyOn(serverModule, 'forwardEvent').mockRejectedValue(new Error('forward timed out'))

    await expect(
      runReplay('evt_test', { to: 'http://localhost:3000/webhook' }, { terminal: fakeTerminal() }),
    ).rejects.toThrow(/failed to replay/i)

    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('outputs JSON when --json flag is set', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const stdout = fakeStdout()
    const event = makeEvent()

    storage.load.mockReturnValue(event)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    vi.spyOn(serverModule, 'forwardEvent').mockResolvedValue({
      status: 200,
      body: 'ok',
    })

    await runReplay('evt_test', { json: true }, { terminal, stdout: stdout.stream })

    expect(terminal.printReplayResult).not.toHaveBeenCalled()

    const parsed = JSON.parse(stdout.written().trim())
    expect(parsed).toEqual({ status: 200, body: 'ok' })
    expect(storage.close).toHaveBeenCalledTimes(1)
  })

  it('emits full body in JSON mode without truncation', async () => {
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const stdout = fakeStdout()
    const event = makeEvent()
    const longBody = 'x'.repeat(210)

    storage.load.mockReturnValue(event)

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    vi.spyOn(serverModule, 'forwardEvent').mockResolvedValue({
      status: 200,
      body: longBody,
    })

    await runReplay('evt_test', { json: true }, { terminal, stdout: stdout.stream })

    const parsed = JSON.parse(stdout.written().trim())
    expect(parsed).toEqual({ status: 200, body: longBody })
  })
})
