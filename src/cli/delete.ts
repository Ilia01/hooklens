import { Command } from 'commander'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'
import { runCommandAction, withDefaultStorage } from './runtime.js'

export interface DeleteDeps {
  terminal?: TerminalUI
}

export async function runDelete(eventId: string, deps: DeleteDeps = {}): Promise<void> {
  const terminal = deps.terminal ?? createTerminal()

  return withDefaultStorage((storage) => {
    const deleted = storage.delete(eventId)

    if (!deleted) {
      throw new Error(`Event "${eventId}" not found.`)
    }

    terminal.printDeleted(eventId)
  })
}

export const deleteCommand = new Command('delete')
  .description('Delete a stored webhook event')
  .argument('<event-id>', 'ID of the event to delete')
  .addHelpText(
    'after',
    `
Examples:
  hooklens delete evt_abc123`,
  )
  .action(async (eventId) => {
    await runCommandAction((terminal) => runDelete(eventId, { terminal }))
  })
