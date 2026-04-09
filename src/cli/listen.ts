import { Command } from 'commander'
import { errorMessage } from '../errors.js'
import { createServer, type Server } from '../server/index.js'
import { createStorage, defaultDbPath } from '../storage/index.js'
import type { VerificationResult, Verifier, WebhookEvent } from '../types.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'
import { createGitHubVerifier } from '../verify/github.js'
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
    case 'github': {
      if (!flags.secret) {
        throw new Error('--secret is required when --verify github is set')
      }
      return createGitHubVerifier({ secret: flags.secret })
    }
    default:
      throw new Error(`Unknown --verify provider "${flags.verify}". Supported: stripe, github`)
  }
}

async function stopServer(server: Server | null): Promise<void> {
  if (!server) return
  await server.stop()
}

function printEventCapturedBestEffort(
  terminal: TerminalUI,
  event: WebhookEvent,
  result: VerificationResult | null,
): void {
  try {
    terminal.printEventCaptured(event, result)
  } catch (error) {
    console.error(`Failed to print captured event: ${errorMessage(error)}`)
  }
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

    let stopError: unknown = null

    try {
      await stopServer(server)
    } catch (error) {
      stopError = error
    } finally {
      storage.close()
    }

    if (stopError) {
      throw stopError
    }

    if (printStopped) {
      terminal.printListenStopped()
    }
  }

  let settle: (() => void) | null = null
  let fail: ((error: unknown) => void) | null = null
  const shutdown = new Promise<void>((resolve, reject) => {
    settle = resolve
    fail = reject
  })

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
      onEvent: (event, result) => printEventCapturedBestEffort(terminal, event, result),
      onForwardError: (event, error) => terminal.printForwardError(event.id, error.message),
    })

    signals.on('SIGINT', onSignal)
    signals.on('SIGTERM', onSignal)
    listenersAttached = true

    await server.start()

    if (cleanedUp) {
      return await shutdown
    }

    terminal.printListenStarted({
      port: server.port,
      dbPath,
      verifier: verifier?.provider,
      forwardTo: flags.forwardTo,
    })

    return await shutdown
  } catch (error) {
    if (cleanedUp) {
      return await shutdown
    }

    await cleanup(false)
    throw error
  }
}

export const listenCommand = new Command('listen')
  .description('Start receiving webhooks')
  .option('-p, --port <port>', 'Port to listen on', '4400')
  .option('--verify <provider>', 'Verify signatures (stripe, github)')
  .option('--secret <secret>', 'Webhook signing secret')
  .option('--forward-to <url>', 'Forward received webhooks to this URL')
  .addHelpText(
    'after',
    `
Examples:
  hooklens listen
  hooklens listen -p 8080 --forward-to http://localhost:3000/webhook
  hooklens listen --verify stripe --secret whsec_xxx
  hooklens listen --verify github --secret ghsecret_xxx`,
  )
  .action(async (options) => {
    const terminal = createTerminal()

    try {
      await runListen(options, { terminal })
    } catch (error) {
      terminal.printError(errorMessage(error))

      process.exitCode = 1
    }
  })
