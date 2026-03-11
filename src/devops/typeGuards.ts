export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getNumericIdFromResponse(data: unknown): number | null {
  if (!isObject(data)) {
    return null;
  }

  const idValue = data.id;
  if (typeof idValue !== 'number' || !Number.isFinite(idValue)) {
    return null;
  }

  return idValue;
}

