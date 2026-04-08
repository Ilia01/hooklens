import chalk from 'chalk'
import type { VerificationResult, WebhookEvent } from '../types.js'

export interface ListenStartedInfo {
  port: number
  dbPath: string
  verifier?: string
  forwardTo?: string
}

export interface TerminalUI {
  printListenStarted(info: ListenStartedInfo): void
  printEventCaptured(event: WebhookEvent, result: VerificationResult | null): void
  printListenStopped(): void
  printError(message: string): void
}

function writeLine(stream: NodeJS.WriteStream, line: string): void {
  stream.write(`${line}\n`)
}

function verificationLabel(result: VerificationResult | null): string {
  if (!result) return chalk.cyan('RECV')
  return result.valid ? chalk.green('PASS') : chalk.red('FAIL')
}

export function createTerminal(
  stdout: NodeJS.WriteStream = process.stdout,
  stderr: NodeJS.WriteStream = process.stderr,
): TerminalUI {
  return {
    printListenStarted(info) {
      writeLine(
        stdout,
        `${chalk.bold('Listening on')} ${chalk.cyan(`http://127.0.0.1:${info.port}`)}`,
      )

      writeLine(stdout, `Verifier: ${info.verifier ?? 'none'}`)
      writeLine(stdout, `Forwarding to: ${info.forwardTo ?? 'disabled'}`)
      writeLine(stdout, `Storage: ${info.dbPath}`)
    },

    printEventCaptured(event, result) {
      const label = verificationLabel(result)
      const summary = `${label} ${chalk.bold(event.id)} ${event.method} ${event.path}`

      if (!result) {
        writeLine(stdout, summary)
        return
      }

      writeLine(stdout, `${summary} ${result.message}`)
    },

    printListenStopped() {
      writeLine(stdout, chalk.dim('Stopped listening.'))
    },

    printError(message) {
      writeLine(stderr, chalk.red(message))
    },
  }
}
