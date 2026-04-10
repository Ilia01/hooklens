export function writeJsonLine(stdout: NodeJS.WritableStream, data: unknown): void {
  stdout.write(JSON.stringify(data) + '\n')
}
