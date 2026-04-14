function toJsonValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64')
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue)
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    const output: Record<string, unknown> = {}

    for (const [key, entry] of Object.entries(input)) {
      output[key] = toJsonValue(entry)
    }

    if ('bodyRaw' in input && 'bodyText' in input && 'bodyExact' in input && !('body' in output)) {
      output.body = output.bodyText ?? null
    }

    return output
  }

  return value
}

export function writeJsonLine(stdout: NodeJS.WritableStream, data: unknown): void {
  const json = JSON.stringify(toJsonValue(data))
  if (json === undefined) {
    throw new Error(
      'Cannot serialize value to JSON - received a non-serializable type (undefined, function, or symbol)',
    )
  }
  stdout.write(json + '\n')
}
