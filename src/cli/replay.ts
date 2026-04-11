import { Command } from 'commander'
import { errorMessage } from '../errors.js'
import { forwardEvent } from '../server/index.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'
import { DEFAULT_REPLAY_TARGET_URL } from './defaults.js'
import { writeJsonLine } from './json-output.js'
import { runCommandAction, withDefaultStorage } from './runtime.js'

export interface ReplayFlags {
  to?: string
  json?: boolean
}

export interface ReplayDeps {
  terminal?: TerminalUI
  stdout?: NodeJS.WritableStream
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

  return withDefaultStorage(async (storage) => {
    const event = storage.load(eventId)

    if (!event) {
      throw new Error(`Event "${eventId}" not found.`)
    }

    try {
      const result = await forwardEvent(targetUrl, event)

      if (flags.json) {
        const out = deps.stdout ?? process.stdout
        writeJsonLine(out, { status: result.status, body: result.body })
      } else {
        const body = result.body.length <= 200 ? result.body : `${result.body.slice(0, 197)}...`
        terminal.printReplayResult({
          status: result.status,
          body,
        })
      }
    } catch (error) {
      throw new Error(`Failed to replay "${eventId}" to ${targetUrl}: ${errorMessage(error)}`)
    }
  })
}

export const replayCommand = new Command('replay')
  .description('Replay a stored webhook event')
  .argument('<event-id>', 'ID of the event to replay')
  .option('--to <url>', 'Target URL to send the event to', DEFAULT_REPLAY_TARGET_URL)
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  hooklens replay evt_abc123
  hooklens replay evt_abc123 --to http://localhost:8080/hook
  hooklens replay evt_abc123 --json`,
  )
  .action(async (eventId, options) => {
    await runCommandAction((terminal) => runReplay(eventId, options, { terminal }))
  })
