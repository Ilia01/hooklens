import { Command } from 'commander'
import { errorMessage } from '../errors.js'
import { clearCommand } from './clear.js'
import { deleteCommand } from './delete.js'
import { inspectCommand } from './inspect.js'
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
program.addCommand(inspectCommand)
program.addCommand(replayCommand)
program.addCommand(deleteCommand)
program.addCommand(clearCommand)

try {
  await program.parseAsync(process.argv)
} catch (error) {
  console.error(errorMessage(error))
  process.exitCode = 1
}
