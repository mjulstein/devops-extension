import type { PatRecord } from '@/types';

// Transport for the Azure DevOps PAT Lifecycle API. Each call takes an explicit,
// already-confirmed-fresh Bearer token and runs in the service worker (no cookie
// auth, credentials omitted). Rotation is create-new + revoke-old; the Extend
// (`PUT validTo`) operation is deliberately never used. See CONTEXT.md + spec FR-004.

const PAT_API_VERSION = '7.1-preview.1';
// vso.work_write:    read/write work items (the core feature).
// vso.code:          read pull requests so the side panel can show an item's
//                    active PR and whether it is approved. Azure DevOps has no
//                    PR-only scope, so this also permits reading repository
//                    contents.
// vso.settings_write: read and set the user's own theme, so the panel can follow
//                    Azure DevOps's light/dark setting and change it from the
//                    switch. The settings entries API rejects a token without
//                    it, which is a 401 and reads as a lost connection.
//
// Widening this list rotates every existing PAT: decideRotation treats a stored
// scope that differs from this one as a reason to mint a new token.
export const PAT_SCOPE = 'vso.work_write vso.code vso.settings_write';

// What to ask for, best first. An organization can forbid a scope by policy, and
// the whole extension runs on this token — so being refused the settings scope
// must cost the theme switch, not work items. The narrower scope is tried next
// and marked as a fallback so it is not mistaken for an out-of-date token.
export const PAT_CORE_SCOPE = 'vso.work_write vso.code';
const PAT_SCOPE_PREFERENCES = [PAT_SCOPE, PAT_CORE_SCOPE] as const;

/**
 * Whether a failed creation is worth retrying with fewer scopes.
 *
 * Only a refusal is: the request was understood and declined. A 500, or a
 * network error, says nothing about the scope and must not quietly narrow the
 * token the user ends up with.
 */
export function isScopeRefusal(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}
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
  let lastError: Error | null = null;

  for (const scope of PAT_SCOPE_PREFERENCES) {
    try {
      return await createPatWithScope(
        bearerToken,
        organization,
        displayName,
        validToMs,
        scope
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!(error instanceof ScopeRefusedError)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('PAT creation failed.');
}

/** Raised when Azure DevOps declines the request, which a narrower scope may fix. */
class ScopeRefusedError extends Error {}

async function createPatWithScope(
  bearerToken: string,
  organization: string,
  displayName: string,
  validToMs: number,
  scope: string
): Promise<PatRecord> {
  const validTo = new Date(validToMs).toISOString();

  const response = await patApiFetch(bearerToken, patListUrl(organization), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName,
      scope,
      validTo,
      allOrgs: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    const message = `PAT creation failed: HTTP ${response.status}\n${text}`;
    throw isScopeRefusal(response.status)
      ? new ScopeRefusedError(message)
      : new Error(message);
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
    displayName,
    scope,
    scopeFallback: scope !== PAT_SCOPE
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
