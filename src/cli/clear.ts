import { Command } from 'commander'
import { createTerminal, type TerminalUI } from '../ui/terminal.js'
import { runCommandAction, withDefaultStorage } from './runtime.js'

export interface ClearFlags {
  yes?: boolean
}

export interface ClearDeps {
  terminal?: TerminalUI
  confirm?: () => Promise<boolean>
}

async function defaultConfirm(): Promise<boolean> {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  return new Promise((resolve) => {
    rl.question('Delete all stored events? [y/N] ', (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

export async function runClear(flags: ClearFlags, deps: ClearDeps = {}): Promise<void> {
  const terminal = deps.terminal ?? createTerminal()

  if (!flags.yes) {
    const confirm = deps.confirm ?? defaultConfirm
    const confirmed = await confirm()

    if (!confirmed) {
      return
    }
  }

  return withDefaultStorage((storage) => {
    const count = storage.clear()
    terminal.printCleared(count)
  })
}

export const clearCommand = new Command('clear')
  .description('Delete all stored webhook events')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    `
Examples:
  hooklens clear --yes
  hooklens clear`,
  )
  .action(async (options) => {
    await runCommandAction((terminal) => runClear(options, { terminal }))
  })
