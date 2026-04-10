export function writeJsonLine(stdout: NodeJS.WriteStream, data: unknown): void {
  stdout.write(JSON.stringify(data) + '\n')
}
