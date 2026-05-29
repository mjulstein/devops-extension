import type { PatRecord } from '@/types';

const PAT_SUFFIX = '-devopsext';
const PAT_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;
const PAT_ROTATION_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const PAT_API_VERSION = '7.1-preview.1';
const PAT_SCOPE = 'vso.work_write';
export const DEVICE_ID_KEY = 'devopsExtDeviceId';
export const PAT_RECORD_KEY = 'devopsExtPat';

export async function getDeviceId(): Promise<string> {
  const stored = await chrome.storage.local.get(DEVICE_ID_KEY);
  const existing = stored[DEVICE_ID_KEY];
  if (typeof existing === 'string' && existing) {
    return existing;
  }
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  await chrome.storage.local.set({ [DEVICE_ID_KEY]: id });
  return id;
}

export function buildPatName(deviceId: string): string {
  return `${deviceId}${PAT_SUFFIX}`;
}

const PAT_FETCH_TIMEOUT_MS = 15_000;

function patListUrl(organization: string): string {
  return `https://vssps.dev.azure.com/${encodeURIComponent(organization)}/_apis/tokens/pats?api-version=${PAT_API_VERSION}`;
}

function patFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(PAT_FETCH_TIMEOUT_MS) });
}

export async function createPat(
  organization: string,
  displayName: string
): Promise<PatRecord> {
  const validTo = new Date(Date.now() + PAT_VALIDITY_MS).toISOString();

  const response = await patFetch(patListUrl(organization), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, scope: PAT_SCOPE, validTo, allOrgs: false })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PAT creation failed: HTTP ${response.status}\n${text}`);
  }

  const data: unknown = await response.json();
  const pat = extractPatToken(data);

  if (!pat?.token || !pat.authorizationId) {
    throw new Error('PAT creation response missing token or authorizationId.');
  }

  return {
    token: pat.token,
    authorizationId: pat.authorizationId,
    expiresAt: new Date(pat.validTo).getTime(),
    displayName
  };
}

export async function renewPat(
  organization: string,
  record: PatRecord
): Promise<PatRecord> {
  const validTo = new Date(Date.now() + PAT_VALIDITY_MS).toISOString();

  const response = await patFetch(patListUrl(organization), {
    method: 'PUT',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authorizationId: record.authorizationId,
      displayName: record.displayName,
      scope: PAT_SCOPE,
      validTo,
      allOrgs: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PAT renewal failed: HTTP ${response.status}\n${text}`);
  }

  // PUT only extends the expiry — token value is unchanged
  return { ...record, expiresAt: new Date(validTo).getTime() };
}

export async function revokePat(
  organization: string,
  authorizationId: string
): Promise<void> {
  const url =
    `https://vssps.dev.azure.com/${encodeURIComponent(organization)}/_apis/tokens/pats` +
    `?authorizationId=${encodeURIComponent(authorizationId)}&api-version=${PAT_API_VERSION}`;

  const response = await patFetch(url, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`PAT revocation failed: HTTP ${response.status}\n${text}`);
  }
}

export async function listExtensionPats(
  organization: string
): Promise<{ displayName: string; authorizationId: string; validTo: string }[]> {
  const result: { displayName: string; authorizationId: string; validTo: string }[] = [];
  let continuationToken: string | null = null;

  do {
    const url = continuationToken
      ? `${patListUrl(organization)}&continuationToken=${encodeURIComponent(continuationToken)}`
      : patListUrl(organization);

    const response = await patFetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      break;
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.patTokens)) {
      break;
    }

    for (const item of data.patTokens) {
      if (
        isRecord(item) &&
        typeof item.displayName === 'string' &&
        typeof item.authorizationId === 'string' &&
        item.displayName.endsWith(PAT_SUFFIX)
      ) {
        result.push({
          displayName: item.displayName,
          authorizationId: item.authorizationId,
          validTo: typeof item.validTo === 'string' ? item.validTo : ''
        });
      }
    }

    continuationToken =
      isRecord(data) && typeof data.continuationToken === 'string'
        ? data.continuationToken
        : null;
  } while (continuationToken);

  return result;
}

export async function revokeAllExtensionPats(organization: string): Promise<number> {
  const pats = await listExtensionPats(organization);
  await Promise.all(
    pats.map((pat) => revokePat(organization, pat.authorizationId).catch(() => undefined))
  );
  return pats.length;
}

export async function ensureValidPat(organization: string): Promise<PatRecord> {
  const stored = await chrome.storage.local.get(PAT_RECORD_KEY);
  const existing = parsePatRecord(stored[PAT_RECORD_KEY]);
  const deviceId = await getDeviceId();
  const displayName = buildPatName(deviceId);

  if (existing && existing.expiresAt - Date.now() > PAT_ROTATION_THRESHOLD_MS) {
    return existing;
  }

  if (existing) {
    try {
      const renewed = await renewPat(organization, existing);
      await chrome.storage.local.set({ [PAT_RECORD_KEY]: renewed });
      return renewed;
    } catch {
      // PAT was revoked externally — fall through to fresh create
    }
  }

  // Find and revoke any remote stale entry with our name, then create fresh
  try {
    const remote = await listExtensionPats(organization);
    const match = remote.find((p) => p.displayName === displayName);
    if (match) {
      await revokePat(organization, match.authorizationId).catch(() => undefined);
    }
  } catch {
    // If listing fails, proceed to create anyway
  }

  const fresh = await createPat(organization, displayName);
  await chrome.storage.local.set({ [PAT_RECORD_KEY]: fresh });
  return fresh;
}

export function parsePatRecord(value: unknown): PatRecord | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.token !== 'string' ||
    typeof value.authorizationId !== 'string' ||
    typeof value.expiresAt !== 'number' ||
    typeof value.displayName !== 'string'
  ) {
    return null;
  }
  return {
    token: value.token,
    authorizationId: value.authorizationId,
    expiresAt: value.expiresAt,
    displayName: value.displayName
  };
}

function extractPatToken(
  data: unknown
): { token?: string; authorizationId: string; validTo: string } | null {
  if (!isRecord(data) || !isRecord(data.patToken)) return null;
  const { patToken } = data;
  if (typeof patToken.authorizationId !== 'string' || typeof patToken.validTo !== 'string') {
    return null;
  }
  return {
    token: typeof patToken.token === 'string' ? patToken.token : undefined,
    authorizationId: patToken.authorizationId,
    validTo: patToken.validTo
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
