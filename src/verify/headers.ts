import { tryDecodeUtf8 } from '../types.js'

export function getHeaderCaseInsensitive(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const expected = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === expected) return value
  }
  return undefined
}

export function tryCanonicalForm(payload: string | Uint8Array): string | null {
  const text = typeof payload === 'string' ? payload : tryDecodeUtf8(payload)
  if (text === null) return null

  try {
    const canonical = JSON.stringify(JSON.parse(text))
    return canonical === text ? null : canonical
  } catch {
    return null
  }
}
