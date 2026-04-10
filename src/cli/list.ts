import { Command } from 'commander'
import { errorMessage } from '../errors.js'
import { createStorage, defaultDbPath } from '../storage/index.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'
import { writeJsonLine } from './json-output.js'

export interface ListFlags {
  limit?: string | number
  json?: boolean
}

export interface ListDeps {
  terminal?: TerminalUI
  stdout?: NodeJS.WritableStream
}

function parseLimit(limit: string | number | undefined): number {
  const raw = limit
  const parsed = typeof raw === 'number' ? raw : Number(raw)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid limit "${raw}". Expected a positive integer.`)
  }

  return parsed
}

export async function runList(flags: ListFlags, deps: ListDeps = {}): Promise<void> {
  const limit = parseLimit(flags.limit ?? '20')
  const terminal = deps.terminal ?? createTerminal()
  const storage = createStorage(defaultDbPath())

  try {
    const events = storage.list(limit)

    if (flags.json) {
      const out = deps.stdout ?? process.stdout

      for (const event of events) {
        writeJsonLine(out, {
          id: event.id,
          timestamp: event.timestamp,
          method: event.method,
          path: event.path,
        })
      }
    } else {
      terminal.printEventList(events)
    }
  } finally {
    storage.close()
  }
}

export const listCommand = new Command('list')
  .description('Show received webhook events')
  .option('-n, --limit <count>', 'Number of events to show', '20')
  .option('--json', 'Output as newline-delimited JSON')
  .addHelpText(
    'after',
    `
Examples:
  hooklens list
  hooklens list -n 5
  hooklens list --json`,
  )
  .action(async (options) => {
    const terminal = createTerminal()

    try {
      await runList(options, { terminal })
    } catch (error) {
      terminal.printError(errorMessage(error))
      process.exitCode = 1
    }
  })
