import os from 'node:os'
import path from 'node:path'
import { Command } from 'commander'
import { createServer, type Server } from '../server/index.js'
import { createStorage } from '../storage/index.js'
import type { Verifier } from '../types.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'
import { createStripeVerifier } from '../verify/stripe.js'

export interface ListenFlags {
  port?: string | number
  verify?: string
  secret?: string
  forwardTo?: string
}

export interface SignalBus {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): void
  off(event: 'SIGINT' | 'SIGTERM', listener: () => void): void
}

export interface ListenDeps {
  signals?: SignalBus
  terminal?: TerminalUI
}

export function defaultDbPath(): string {
  return path.join(os.homedir(), '.hooklens', 'events.db')
}

function parsePort(port: string | number | undefined): number {
  const raw = port
  const parsed = typeof raw === 'number' ? raw : Number(raw)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error(`Invalid port "${raw}". Expected an integer between 0 and 65535.`)
  }

  return parsed
}

/** Maps --verify flags to a Verifier. See CONTRIBUTING.md → Adding a provider. */
export function buildVerifier(flags: ListenFlags): Verifier | undefined {
  if (!flags.verify) return undefined

  switch (flags.verify) {
    case 'stripe': {
      if (!flags.secret) {
        throw new Error('--secret is required when --verify stripe is set')
      }
      return createStripeVerifier({ secret: flags.secret })
    }
    default:
      throw new Error(`Unknown --verify provider "${flags.verify}". Supported: stripe`)
  }
}

async function stopServer(server: Server | null): Promise<void> {
  if (!server) return
  try {
    await server.stop()
  } catch {}
}

export async function runListen(flags: ListenFlags, deps: ListenDeps = {}): Promise<void> {
  const port = parsePort(flags.port)
  const verifier = buildVerifier(flags)
  const dbPath = defaultDbPath()
  const signals = deps.signals ?? process
  const terminal = deps.terminal ?? createTerminal()
  const storage = createStorage(dbPath)

  let server: Server | null = null
  let cleanedUp = false
  let listenersAttached = false

  const cleanup = async (printStopped: boolean): Promise<void> => {
    if (cleanedUp) return
    cleanedUp = true
    if (listenersAttached) {
      signals.off('SIGINT', onSignal)
      signals.off('SIGTERM', onSignal)
      listenersAttached = false
    }

    await stopServer(server)
    storage.close()

    if (printStopped) {
      terminal.printListenStopped()
    }
  }

  let settle: (() => void) | null = null
  let fail: ((error: unknown) => void) | null = null

  const onSignal = () => {
    void cleanup(true).then(
      () => settle?.(),
      (error) => fail?.(error),
    )
  }

  try {
    server = createServer({
      port,
      storage,
      verifier,
      forwardTo: flags.forwardTo,
      onEvent: (event, result) => terminal.printEventCaptured(event, result),
    })

    await server.start()

    terminal.printListenStarted({
      port: server.port,
      dbPath,
      verifier: verifier?.provider,
      forwardTo: flags.forwardTo,
    })

    return await new Promise<void>((resolve, reject) => {
      settle = resolve
      fail = reject
      signals.on('SIGINT', onSignal)
      signals.on('SIGTERM', onSignal)
      listenersAttached = true
    })
  } catch (error) {
    await cleanup(false)
    throw error
  }
}

export const listenCommand = new Command('listen')
  .description('Start receiving webhooks')
  .option('-p, --port <port>', 'Port to listen on', '4400')
  .option('--verify <provider>', 'Verify signatures (stripe)')
  .option('--secret <secret>', 'Webhook signing secret')
  .option('--forward-to <url>', 'Forward received webhooks to this URL')
  .action(async (options) => {
    const terminal = createTerminal()

    try {
      await runListen(options, { terminal })
    } catch (error) {
      terminal.printError(error instanceof Error ? error.message : String(error))

      process.exitCode = 1
    }
  })
