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

export function tryCanonicalForm(payload: string): string | null {
  try {
    const canonical = JSON.stringify(JSON.parse(payload))
    return canonical === payload ? null : canonical
  } catch {
    return null
  }
}
