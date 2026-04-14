import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ServerOptions, Server } from '../../src/server/index.js'
import * as serverModule from '../../src/server/index.js'
import * as storageModule from '../../src/storage/index.js'
import type { VerificationResult, WebhookEvent } from '../../src/types.js'
import { buildVerifier, runListen } from '../../src/cli/listen.js'
import { defaultDbPath } from '../../src/storage/index.js'
import { fakeStorage, fakeTerminal } from '../helpers.js'

function nextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildVerifier', () => {
  it('returns undefined when --verify is not set', () => {
    expect(buildVerifier({})).toBeUndefined()
    expect(buildVerifier({ secret: 'whsec_xxx' })).toBeUndefined()
  })

  it('returns a stripe Verifier when --verify=stripe and --secret are both set', () => {
    const verifier = buildVerifier({ verify: 'stripe', secret: 'whsec_xxx' })
    expect(verifier).toBeDefined()
    expect(verifier?.provider).toBe('stripe')
    expect(typeof verifier?.verify).toBe('function')
  })

  it('throws when --verify=stripe is set without --secret', () => {
    expect(() => buildVerifier({ verify: 'stripe' })).toThrow(/secret/i)
  })

  it('throws on an unknown provider with a helpful message', () => {
    expect(() => buildVerifier({ verify: 'paddle', secret: 'x' })).toThrow(/unknown.*paddle/i)
  })

  it('returns a github Verifier when --verify=github and --secret are both set', () => {
    const verifier = buildVerifier({ verify: 'github', secret: 'ghsecret_xxx' })
    expect(verifier).toBeDefined()
    expect(verifier?.provider).toBe('github')
    expect(typeof verifier?.verify).toBe('function')
  })

  it('throws when --verify=github is set without --secret', () => {
    expect(() => buildVerifier({ verify: 'github' })).toThrow(/secret/i)
  })

  it('produces a Verifier whose verify() actually returns a result', () => {
    // Round-trip: build it from flags, then call verify and confirm we get
    // a real VerificationResult back. This is the "verify the verifier" check.
    const verifier = buildVerifier({ verify: 'stripe', secret: 'whsec_xxx' })
    const result = verifier?.verify({
      headers: {},
      bodyRaw: Buffer.from('{}'),
    })
    expect(result).toBeDefined()
    expect(result?.provider).toBe('stripe')
    // No header was passed, so this should land on missing_header
    expect(result?.code).toBe('missing_header')
  })
})

describe('runListen', () => {
  it('starts the server with parsed flags and shuts down on signal', async () => {
    const signals = new EventEmitter()
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    let capturedOptions: ServerOptions | undefined
    let port = 4400

    const dbPath = defaultDbPath()
    const server: Server = {
      get port() {
        return port
      },
      start: vi.fn(async () => {
        port = 4411
      }),
      stop: vi.fn(async () => {}),
    }

    const createServerMock = vi.fn((opts: ServerOptions) => {
      capturedOptions = opts
      return server
    })

    const createStorageMock = vi
      .spyOn(storageModule, 'createStorage')
      .mockReturnValue(storage as never)

    vi.spyOn(serverModule, 'createServer').mockImplementation(createServerMock)

    const running = runListen(
      {
        port: '0',
        verify: 'stripe',
        secret: 'whsec_xxx',
        forwardTo: 'http://localhost:3000/webhook',
      },
      { signals: signals as never, terminal },
    )

    await nextTick()

    expect(createServerMock).toHaveBeenCalledTimes(1)
    expect(createStorageMock).toHaveBeenCalledWith(dbPath)
    expect(capturedOptions?.port).toBe(0)
    expect(capturedOptions?.forwardTo).toBe('http://localhost:3000/webhook')
    expect(capturedOptions?.verifier?.provider).toBe('stripe')
    expect(terminal.printListenStarted).toHaveBeenCalledWith({
      port: 4411,
      dbPath,
      verifier: 'stripe',
      forwardTo: 'http://localhost:3000/webhook',
    })

    signals.emit('SIGINT')
    await running

    expect(server.stop).toHaveBeenCalledTimes(1)
    expect(storage.close).toHaveBeenCalledTimes(1)
    expect(terminal.printListenStopped).toHaveBeenCalledTimes(1)
  })

  it('handles shutdown signals during startup', async () => {
    const signals = new EventEmitter()
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    const server: Server = {
      port: 4400,
      start: vi.fn(async () => {
        signals.emit('SIGINT')
        await nextTick()
      }),
      stop: vi.fn(async () => {}),
    }

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    vi.spyOn(serverModule, 'createServer').mockReturnValue(server)

    await runListen({ port: '4400' }, { signals: signals as never, terminal })

    expect(server.stop).toHaveBeenCalledTimes(1)
    expect(storage.close).toHaveBeenCalledTimes(1)
    expect(terminal.printListenStopped).toHaveBeenCalledTimes(1)
    expect(terminal.printListenStarted).not.toHaveBeenCalled()
  })

  it('surfaces stop failures during shutdown', async () => {
    const signals = new EventEmitter()
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    const server: Server = {
      port: 4400,
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {
        throw new Error('stop failed')
      }),
    }

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    vi.spyOn(serverModule, 'createServer').mockReturnValue(server)

    const running = runListen({ port: '4400' }, { signals: signals as never, terminal })

    await nextTick()

    signals.emit('SIGINT')

    await expect(running).rejects.toThrow('stop failed')
    expect(storage.close).toHaveBeenCalledTimes(1)
    expect(terminal.printListenStopped).not.toHaveBeenCalled()
  })

  it('prints captured events through the terminal onEvent callback', async () => {
    const signals = new EventEmitter()
    const storage = fakeStorage()
    const terminal = fakeTerminal()

    let capturedOptions: ServerOptions | undefined

    const server: Server = {
      port: 4400,
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    }

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    vi.spyOn(serverModule, 'createServer').mockImplementation((opts: ServerOptions) => {
      capturedOptions = opts
      return server
    })

    const running = runListen({ port: '4400' }, { signals: signals as never, terminal })

    await nextTick()

    const event: WebhookEvent = {
      id: 'evt_test',
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/webhook',
      headers: {},
      bodyRaw: Buffer.from('{}'),
      bodyText: '{}',
      bodyExact: true,
    }
    const result: VerificationResult = {
      valid: true,
      provider: 'stripe',
      code: 'valid',
      message: 'Signature verified.',
    }

    capturedOptions?.onEvent?.(event, result)

    expect(terminal.printEventCaptured).toHaveBeenCalledWith(event, result)

    signals.emit('SIGTERM')
    await running
  })

  it('swallows terminal event rendering errors', async () => {
    const signals = new EventEmitter()
    const storage = fakeStorage()
    const terminal = fakeTerminal()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    let capturedOptions: ServerOptions | undefined

    terminal.printEventCaptured = vi.fn(() => {
      throw new Error('render failed')
    })

    const server: Server = {
      port: 4400,
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    }

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)

    vi.spyOn(serverModule, 'createServer').mockImplementation((opts: ServerOptions) => {
      capturedOptions = opts
      return server
    })

    const running = runListen({ port: '4400' }, { signals: signals as never, terminal })

    await nextTick()

    const event: WebhookEvent = {
      id: 'evt_test',
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/webhook',
      headers: {},
      bodyRaw: Buffer.from('{}'),
      bodyText: '{}',
      bodyExact: true,
    }
    const result: VerificationResult = {
      valid: true,
      provider: 'stripe',
      code: 'valid',
      message: 'Signature verified.',
    }

    expect(() => capturedOptions?.onEvent?.(event, result)).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith('Failed to print captured event: render failed')

    signals.emit('SIGTERM')
    await running
  })

  it('rejects invalid port values before creating runtime dependencies', async () => {
    const createStorageMock = vi.spyOn(storageModule, 'createStorage')
    const createServerMock = vi.spyOn(serverModule, 'createServer')

    await expect(runListen({ port: 'nope' })).rejects.toThrow(/invalid port/i)

    expect(createStorageMock).not.toHaveBeenCalled()
    expect(createServerMock).not.toHaveBeenCalled()
  })

  it('closes storage when server startup fails', async () => {
    const storage = fakeStorage()
    const server: Server = {
      port: 4400,
      start: vi.fn(async () => {
        throw new Error('listen failed')
      }),
      stop: vi.fn(async () => {}),
    }

    vi.spyOn(storageModule, 'createStorage').mockReturnValue(storage as never)
    vi.spyOn(serverModule, 'createServer').mockReturnValue(server)

    await expect(
      runListen(
        { port: '4400' },
        { signals: new EventEmitter() as never, terminal: fakeTerminal() },
      ),
    ).rejects.toThrow('listen failed')

    expect(server.stop).toHaveBeenCalledTimes(1)
    expect(storage.close).toHaveBeenCalledTimes(1)
  })
})
