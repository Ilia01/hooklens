import { Command } from 'commander'
import { errorMessage } from '../errors.js'
import { forwardEvent } from '../server/index.js'
import { createStorage, defaultDbPath } from '../storage/index.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'

const DEFAULT_REPLAY_TARGET_URL = 'http://localhost:3000/webhook'

export interface ReplayFlags {
  to?: string
}

export interface ReplayDeps {
  terminal?: TerminalUI
}

function parseTargetUrl(targetUrl: string | undefined): string {
  const raw = targetUrl ?? DEFAULT_REPLAY_TARGET_URL

  try {
    return new URL(raw).href
  } catch {
    throw new Error(`Invalid target URL "${raw}".`)
  }
}

export async function runReplay(
  eventId: string,
  flags: ReplayFlags,
  deps: ReplayDeps = {},
): Promise<void> {
  const targetUrl = parseTargetUrl(flags.to)
  const terminal = deps.terminal ?? createTerminal()
  const storage = createStorage(defaultDbPath())

  try {
    const event = storage.load(eventId)

    if (!event) {
      throw new Error(`Event "${eventId}" not found.`)
    }

    try {
      const result = await forwardEvent(targetUrl, event)
      const body = result.body.length <= 200 ? result.body : `${result.body.slice(0, 197)}...`

      terminal.printReplayResult({
        status: result.status,
        body,
      })
    } catch (error) {
      throw new Error(`Failed to replay "${eventId}" to ${targetUrl}: ${errorMessage(error)}`)
    }
  } finally {
    storage.close()
  }
}

export const replayCommand = new Command('replay')
  .description('Replay a stored webhook event')
  .argument('<event-id>', 'ID of the event to replay')
  .option('--to <url>', 'Target URL to send the event to', DEFAULT_REPLAY_TARGET_URL)
  .addHelpText(
    'after',
    `
Examples:
  hooklens replay evt_abc123
  hooklens replay evt_abc123 --to http://localhost:8080/hook`,
  )
  .action(async (eventId, options) => {
    const terminal = createTerminal()

    try {
      await runReplay(eventId, options, { terminal })
    } catch (error) {
      terminal.printError(errorMessage(error))
      process.exitCode = 1
    }
  })
