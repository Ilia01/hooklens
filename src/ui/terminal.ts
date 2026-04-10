import chalk from 'chalk'
import type { ReplayResult, VerificationResult, WebhookEvent } from '../types.js'

export interface ListenStartedInfo {
  port: number
  dbPath: string
  verifier?: string
  forwardTo?: string
}

export interface TerminalUI {
  printListenStarted(info: ListenStartedInfo): void
  printEventCaptured(event: WebhookEvent, result: VerificationResult | null): void
  printForwardError(eventId: string, reason: string): void
  printEventList(events: WebhookEvent[]): void
  printEventDetail(event: WebhookEvent): void
  printReplayResult(result: ReplayResult): void
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

    printForwardError(eventId, reason) {
      writeLine(stdout, `${chalk.red('FWD')} ${chalk.bold(eventId)} ${reason}`)
    },

    printEventList(events) {
      if (!events.length) {
        writeLine(stdout, chalk.dim('No stored events.'))
        return
      }

      for (const event of events) {
        const row = `${chalk.dim(event.timestamp)} ${chalk.cyan(event.method)} ${chalk.bold(event.id)} ${event.path}`
        writeLine(stdout, row)
      }
    },

    printEventDetail(event) {
      writeLine(stdout, `${chalk.bold('Event:')}   ${event.id}`)
      writeLine(stdout, `${chalk.bold('Time:')}    ${event.timestamp}`)
      writeLine(stdout, `${chalk.bold('Method:')}  ${event.method}`)
      writeLine(stdout, `${chalk.bold('Path:')}    ${event.path}`)
      writeLine(stdout, '')
      writeLine(stdout, chalk.bold('Headers:'))

      for (const [key, value] of Object.entries(event.headers)) {
        writeLine(stdout, `  ${key}: ${value}`)
      }

      writeLine(stdout, '')
      writeLine(stdout, chalk.bold('Body:'))

      let bodyText: string
      try {
        bodyText = JSON.stringify(JSON.parse(event.body), null, 2)
      } catch {
        bodyText = event.body
      }

      for (const line of bodyText.split('\n')) {
        writeLine(stdout, `  ${line}`)
      }
    },

    printReplayResult(result) {
      const summary = `${chalk.bold('Replay response:')} ${chalk.cyan(String(result.status))}`

      if (!result.body) {
        writeLine(stdout, summary)
        return
      }

      writeLine(stdout, `${summary} ${result.body}`)
    },

    printListenStopped() {
      writeLine(stdout, chalk.dim('Stopped listening.'))
    },

    printError(message) {
      writeLine(stderr, chalk.red(message))
    },
  }
}
