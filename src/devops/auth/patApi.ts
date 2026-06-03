import type { PatRecord } from '@/types';

// Transport for the Azure DevOps PAT Lifecycle API. Each call takes an explicit,
// already-confirmed-fresh Bearer token and runs in the service worker (no cookie
// auth, credentials omitted). Rotation is create-new + revoke-old; the Extend
// (`PUT validTo`) operation is deliberately never used. See CONTEXT.md + spec FR-004.

const PAT_API_VERSION = '7.1-preview.1';
const PAT_SCOPE = 'vso.work_write';
const PAT_FETCH_TIMEOUT_MS = 15_000;

export interface RemotePatSummary {
  displayName: string;
  authorizationId: string;
  validTo: string;
}

export async function createPat(
  bearerToken: string,
  organization: string,
  displayName: string,
  validToMs: number
): Promise<PatRecord> {
  const validTo = new Date(validToMs).toISOString();

  const response = await patApiFetch(bearerToken, patListUrl(organization), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName,
      scope: PAT_SCOPE,
      validTo,
      allOrgs: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PAT creation failed: HTTP ${response.status}\n${text}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'PAT creation failed: Azure DevOps returned a non-JSON response — the active tab may not be signed in to the right account.'
    );
  }

  const created = extractCreatedPat(await response.json());
  if (!created?.token || !created.authorizationId) {
    throw new Error('PAT creation response missing token or authorizationId.');
  }

  return {
    token: created.token,
    authorizationId: created.authorizationId,
    expiresAt: new Date(created.validTo).getTime(),
    displayName
  };
}

export async function revokePat(
  bearerToken: string,
  organization: string,
  authorizationId: string
): Promise<void> {
  const url =
    `https://vssps.dev.azure.com/${encodeURIComponent(organization)}/_apis/tokens/pats` +
    `?authorizationId=${encodeURIComponent(authorizationId)}&api-version=${PAT_API_VERSION}`;

  const response = await patApiFetch(bearerToken, url, { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`PAT revocation failed: HTTP ${response.status}\n${text}`);
  }
}

export async function listExtensionPats(
  bearerToken: string,
  organization: string
): Promise<RemotePatSummary[]> {
  const result: RemotePatSummary[] = [];
  let continuationToken: string | null = null;

  do {
    const url = continuationToken
      ? `${patListUrl(organization)}&continuationToken=${encodeURIComponent(continuationToken)}`
      : patListUrl(organization);

    const response = await patApiFetch(bearerToken, url, {
      method: 'GET',
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
        item.displayName.endsWith('-devopsext')
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

function patListUrl(organization: string): string {
  return `https://vssps.dev.azure.com/${encodeURIComponent(organization)}/_apis/tokens/pats?api-version=${PAT_API_VERSION}`;
}

function patApiFetch(
  bearerToken: string,
  url: string,
  init: RequestInit
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(
    'Authorization',
    bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`
  );
  return fetch(url, {
    ...init,
    credentials: 'omit',
    headers,
    signal: AbortSignal.timeout(PAT_FETCH_TIMEOUT_MS)
  });
}

function extractCreatedPat(
  data: unknown
): { token?: string; authorizationId: string; validTo: string } | null {
  if (!isRecord(data) || !isRecord(data.patToken)) {
    return null;
  }
  const { patToken } = data;
  if (
    typeof patToken.authorizationId !== 'string' ||
    typeof patToken.validTo !== 'string'
  ) {
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
