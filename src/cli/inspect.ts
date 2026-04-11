import { Command } from 'commander'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'
import { writeJsonLine } from './json-output.js'
import { runCommandAction, withDefaultStorage } from './runtime.js'

export interface InspectFlags {
  json?: boolean
}

export interface InspectDeps {
  terminal?: TerminalUI
  stdout?: NodeJS.WritableStream
}

export async function runInspect(
  eventId: string,
  flags: InspectFlags,
  deps: InspectDeps = {},
): Promise<void> {
  const terminal = deps.terminal ?? createTerminal()

  return withDefaultStorage((storage) => {
    const event = storage.load(eventId)

    if (!event) {
      throw new Error(`Event "${eventId}" not found.`)
    }

    if (flags.json) {
      const out = deps.stdout ?? process.stdout
      writeJsonLine(out, event)
    } else {
      terminal.printEventDetail(event)
    }
  })
}

export const inspectCommand = new Command('inspect')
  .description('View full details of a stored webhook event')
  .argument('<event-id>', 'ID of the event to inspect')
  .option('--json', 'Output as JSON')
  .addHelpText(
    'after',
    `
Examples:
  hooklens inspect evt_abc123
  hooklens inspect evt_abc123 --json`,
  )
  .action(async (eventId, options) => {
    await runCommandAction((terminal) => runInspect(eventId, options, { terminal }))
  })
