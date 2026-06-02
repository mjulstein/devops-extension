// Freshness check for the captured Bearer token. The extension only ever fires a
// PAT-API request with a Bearer it has confirmed is fresh (decoding the JWT `exp`
// claim, requiring a few minutes of headroom); presenting a stale Bearer can break
// the browser session. See CONTEXT.md ("Bearer token") and spec FR-003.
//
// This decodes the JWT payload only — it never verifies the signature (the page
// already trusted it) and performs no network calls.

export const DEFAULT_FRESHNESS_MARGIN_MS = 5 * 60 * 1000;

export function decodeJwtExp(token: string): number | null {
  const raw = token.startsWith('Bearer ')
    ? token.slice('Bearer '.length)
    : token;
  const segments = raw.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(base64UrlDecode(segments[1]));
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).exp === 'number'
    ) {
      return (payload as Record<string, number>).exp;
    }
    return null;
  } catch {
    return null;
  }
}

export function isFresh(
  token: string,
  marginMs: number = DEFAULT_FRESHNESS_MARGIN_MS,
  now: number = Date.now()
): boolean {
  const expSeconds = decodeJwtExp(token);
  if (expSeconds === null) {
    return false;
  }
  return expSeconds * 1000 - now > marginMs;
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return atob(padded);
}
