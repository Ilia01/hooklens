export function writeJsonLine(stdout: NodeJS.WritableStream, data: unknown): void {
  const json = JSON.stringify(data)
  if (json === undefined) {
    throw new Error(
      'Cannot serialize value to JSON – received a non-serializable type (undefined, function, or symbol)',
    )
  }
  stdout.write(json + '\n')
}
