import { Command } from 'commander'
import { listenCommand } from './listen.js'
import { listCommand } from './list.js'
import { replayCommand } from './replay.js'

const program = new Command()

program
  .name('hooklens')
  .description('Inspect, verify, and replay webhooks from your terminal')
  .version('0.1.0')

program.addCommand(listenCommand)
program.addCommand(listCommand)
program.addCommand(replayCommand)

try {
  await program.parseAsync(process.argv)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
