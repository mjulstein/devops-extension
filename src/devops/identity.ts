import { authFetch } from './authFetch';

// The signed-in Azure DevOps identity.
//
// `_apis/connectionData` is the only identity endpoint the extension's PAT
// scopes can reach — `profile/profiles/me` and the graph API both return 401 —
// and it rejects an explicit api-version, so none is sent.

export interface DevOpsIdentity {
  /** Identity GUID, as used by PR reviewer and creator ids. */
  id: string;
  displayName: string;
  /**
   * Account name (an email in practice). This is the value `System.AssignedTo`
   * accepts when creating or updating a work item.
   */
  uniqueName: string;
}

export function parseIdentity(data: unknown): DevOpsIdentity | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const user = (data as { authenticatedUser?: unknown }).authenticatedUser;
  if (!user || typeof user !== 'object') {
    return null;
  }

  const record = user as {
    id?: unknown;
    providerDisplayName?: unknown;
    properties?: { Account?: { $value?: unknown } };
  };

  if (typeof record.id !== 'string' || !record.id) {
    return null;
  }

  const account = record.properties?.Account?.$value;

  return {
    id: record.id,
    displayName:
      typeof record.providerDisplayName === 'string'
        ? record.providerDisplayName
        : '',
    uniqueName: typeof account === 'string' ? account : ''
  };
}

export async function fetchIdentity(
  organization: string
): Promise<DevOpsIdentity | null> {
  const response = await authFetch(
    `https://dev.azure.com/${encodeURIComponent(organization)}/_apis/connectionData`,
    { method: 'GET', headers: { Accept: 'application/json' } }
  );

  if (!response.ok) {
    return null;
  }

  return parseIdentity(await response.json());
}
