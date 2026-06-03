import type { PatRecord } from '@/types';
import { readPatRecord } from './auth/patStore';
import { ensurePat, type EnsurePatOutcome } from './auth/ensurePat';

// Raised when a data call cannot be authenticated and no PAT can be minted right
// now. Callers surface this as the **Reconnect needed** state. authFetch never
// falls back to cookie auth (spec FR-001).
export class ReconnectNeededError extends Error {
  constructor(
    message = 'Reconnect needed: the Azure DevOps connection is unavailable.'
  ) {
    super(message);
    this.name = 'ReconnectNeededError';
  }
}

export interface AuthFetchDeps {
  readPatRecord: () => Promise<PatRecord | null>;
  ensurePat: (options: {
    organization: string;
    force?: boolean;
  }) => Promise<EnsurePatOutcome>;
  fetchFn: typeof fetch;
}

const defaultDeps: AuthFetchDeps = {
  readPatRecord,
  ensurePat,
  fetchFn: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)
};

export async function authFetch(
  url: string,
  init: RequestInit = {},
  deps: AuthFetchDeps = defaultDeps
): Promise<Response> {
  const organization = organizationFromUrl(url);

  const existing = await deps.readPatRecord();
  const token = existing?.token ?? (await mintToken(organization, false, deps));

  const response = await patFetch(deps.fetchFn, url, init, token);
  if (response.status !== 401) {
    return response;
  }

  // PAT rejected — force exactly one rotation and retry. No cookie fallback.
  const rotated = await mintToken(organization, true, deps);
  const retry = await patFetch(deps.fetchFn, url, init, rotated);
  if (retry.status === 401) {
    throw new ReconnectNeededError();
  }
  return retry;
}

async function mintToken(
  organization: string | null,
  force: boolean,
  deps: AuthFetchDeps
): Promise<string> {
  if (!organization) {
    throw new ReconnectNeededError(
      'Could not determine the Azure DevOps organization for this request.'
    );
  }

  const outcome = await deps.ensurePat({ organization, force });
  if (outcome.status !== 'connected' || !outcome.record?.token) {
    throw new ReconnectNeededError();
  }
  return outcome.record.token;
}

function patFetch(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  token: string
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Basic ${btoa(`:${token}`)}`);
  return fetchFn(url, { ...init, credentials: 'omit', headers });
}

function organizationFromUrl(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    // dev.azure.com/{org}/... and vssps.dev.azure.com/{org}/...
    if (hostname === 'dev.azure.com' || hostname === 'vssps.dev.azure.com') {
      const firstSegment = pathname
        .split('/')
        .find((segment) => segment !== '');
      return firstSegment ? decodeURIComponent(firstSegment) : null;
    }
    return null;
  } catch {
    return null;
  }
}
