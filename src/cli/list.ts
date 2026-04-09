import { Command } from 'commander'
import { errorMessage } from '../errors.js'
import { createStorage, defaultDbPath } from '../storage/index.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'

export interface ListFlags {
  limit?: string | number
}

export interface ListDeps {
  terminal?: TerminalUI
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
    terminal.printEventList(events)
  } finally {
    storage.close()
  }
}

export const listCommand = new Command('list')
  .description('Show received webhook events')
  .option('-n, --limit <count>', 'Number of events to show', '20')
  .addHelpText(
    'after',
    `
Examples:
  hooklens list
  hooklens list -n 5`,
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
