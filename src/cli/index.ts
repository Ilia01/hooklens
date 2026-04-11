import { Command } from 'commander'
import packageJson from '../../package.json'
import { errorMessage } from '../errors.js'
import { clearCommand } from './clear.js'
import { deleteCommand } from './delete.js'
import { inspectCommand } from './inspect.js'
import { listenCommand } from './listen.js'
import { listCommand } from './list.js'
import { replayCommand } from './replay.js'

const program = new Command()

program.name('hooklens').description(packageJson.description).version(packageJson.version)

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
