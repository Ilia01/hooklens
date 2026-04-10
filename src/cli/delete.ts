import { Command } from 'commander'
import { errorMessage } from '../errors.js'
import { createStorage, defaultDbPath } from '../storage/index.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'

export interface DeleteDeps {
  terminal?: TerminalUI
}

export async function runDelete(eventId: string, deps: DeleteDeps = {}): Promise<void> {
  const terminal = deps.terminal ?? createTerminal()
  const storage = createStorage(defaultDbPath())

  try {
    const deleted = storage.delete(eventId)

    if (!deleted) {
      throw new Error(`Event "${eventId}" not found.`)
    }

    terminal.printDeleted(eventId)
  } finally {
    storage.close()
  }
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
    const terminal = createTerminal()

    try {
      await runDelete(eventId, { terminal })
    } catch (error) {
      terminal.printError(errorMessage(error))
      process.exitCode = 1
    }
  })
