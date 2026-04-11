import { errorMessage } from '../errors.js'
import { createStorage, defaultDbPath } from '../storage/index.js'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'

type Storage = ReturnType<typeof createStorage>

export async function withDefaultStorage<T>(run: (storage: Storage) => T | Promise<T>): Promise<T> {
  const storage = createStorage(defaultDbPath())

  try {
    return await run(storage)
  } finally {
    try {
      storage.close()
    } catch {
      // Swallow close errors to avoid masking the original error from run().
    }
  }
}

export async function runCommandAction(
  run: (terminal: TerminalUI) => Promise<void>,
): Promise<void> {
  const terminal = createTerminal()

  try {
    await run(terminal)
  } catch (error) {
    terminal.printError(errorMessage(error))
    process.exitCode = 1
  }
}
