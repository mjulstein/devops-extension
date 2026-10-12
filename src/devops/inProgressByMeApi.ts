// The calls behind the "in progress by me" lists.
//
// Three shapes, as described: two WIQL queries for ids, a confirmation pass
// over the second one's history, and a batch read for the details. The
// confirmation is the expensive part — one call per candidate — which is why it
// runs only over the second list, and only over what the query already narrowed.

import { authFetch } from './authFetch';
import { isObject } from './typeGuards';
import {
  buildAssignedWiql,
  buildStartedForOthersWiql,
  wasMovedToStateBy,
  type InProgressByMe,
  type InProgressItem
} from './inProgressByMe';

const FIELDS = [
  'System.Title',
  'System.WorkItemType',
  'System.TeamProject',
  'System.AssignedTo'
] as const;

/** The batch endpoint's own limit. */
const BATCH = 200;

function orgBase(organization: string): string {
  return `https://dev.azure.com/${encodeURIComponent(organization)}`;
}

/**
 * The signed-in identity, for comparing against an update's author.
 *
 * Asked of Azure DevOps rather than stored: the whole point of `@Me` in the
 * queries is that this project never writes the user down, and the
 * confirmation pass needs a name to compare only because the history records
 * one. A saved `assignedTo` is an explicit override and wins.
 */
export async function resolveIdentity(
  organization: string,
  assignedTo: string
): Promise<string> {
  if (assignedTo.trim() !== '') {
    return assignedTo.trim();
  }

  const response = await authFetch(
    `${orgBase(organization)}/_apis/connectionData?api-version=7.1-preview`,
    { method: 'GET', headers: { Accept: 'application/json' } }
  );

  if (!response.ok) {
    return '';
  }

  const data: unknown = await response.json();
  if (!isObject(data) || !isObject(data.authenticatedUser)) {
    return '';
  }
  const properties = data.authenticatedUser.properties;
  const account =
    isObject(properties) && isObject(properties.Account)
      ? properties.Account.$value
      : undefined;
  return typeof account === 'string' ? account : '';
}

async function queryIds(
  organization: string,
  project: string,
  wiql: string
): Promise<number[]> {
  const response = await authFetch(
    `${orgBase(organization)}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: wiql })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `WIQL failed: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data: unknown = await response.json();
  if (!isObject(data) || !Array.isArray(data.workItems)) {
    return [];
  }
  return data.workItems
    .map((entry) => (isObject(entry) ? Number(entry.id) : Number.NaN))
    .filter((id) => Number.isFinite(id));
}

/** Keeps only the candidates whose history shows the user making the move. */
async function confirmStarters(
  organization: string,
  ids: number[],
  state: string,
  identity: string
): Promise<number[]> {
  if (identity === '') {
    return [];
  }

  const confirmed: number[] = [];
  for (const id of ids) {
    try {
      const response = await authFetch(
        `${orgBase(organization)}/_apis/wit/workitems/${id}/updates?api-version=7.1`,
        { method: 'GET', headers: { Accept: 'application/json' } }
      );
      if (!response.ok) {
        continue;
      }
      const data: unknown = await response.json();
      const updates = isObject(data) ? data.value : null;
      if (wasMovedToStateBy(updates, state, identity)) {
        confirmed.push(id);
      }
    } catch {
      // One unreadable history should not take the rest of the list with it.
    }
  }
  return confirmed;
}

export function parseBatch(
  data: unknown,
  organization: string
): InProgressItem[] {
  if (!isObject(data) || !Array.isArray(data.value)) {
    return [];
  }

  const items: InProgressItem[] = [];
  for (const entry of data.value) {
    if (!isObject(entry) || !isObject(entry.fields)) {
      continue;
    }
    const id = Number(entry.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    const fields = entry.fields;
    const assigned = fields['System.AssignedTo'];
    const project = asText(fields['System.TeamProject']);

    items.push({
      id,
      title: asText(fields['System.Title']),
      workItemType: asText(fields['System.WorkItemType']),
      project,
      assignedTo: isObject(assigned) ? asText(assigned.uniqueName) : '',
      url: `${orgBase(organization)}/${encodeURIComponent(project)}/_workitems/edit/${id}`
    });
  }
  return items;
}

function asText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';
}

async function fetchDetails(
  organization: string,
  ids: number[]
): Promise<InProgressItem[]> {
  const items: InProgressItem[] = [];

  for (let index = 0; index < ids.length; index += BATCH) {
    const response = await authFetch(
      `${orgBase(organization)}/_apis/wit/workitemsbatch?api-version=7.1`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: ids.slice(index, index + BATCH),
          fields: [...FIELDS]
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Could not read the work items: HTTP ${response.status} ${response.statusText}\n${text}`
      );
    }

    items.push(...parseBatch(await response.json(), organization));
  }

  return items;
}

export async function fetchInProgressByMe(
  organization: string,
  project: string,
  state: string,
  assignedTo: string
): Promise<InProgressByMe> {
  if (state.trim() === '') {
    throw new Error('Name the state that means in progress.');
  }

  const [assignedIds, candidateIds] = await Promise.all([
    queryIds(organization, project, buildAssignedWiql(state, assignedTo)),
    queryIds(
      organization,
      project,
      buildStartedForOthersWiql(state, assignedTo)
    )
  ]);

  const identity = await resolveIdentity(organization, assignedTo);
  const startedIds = await confirmStarters(
    organization,
    candidateIds,
    state,
    identity
  );

  const details = await fetchDetails(organization, [
    ...assignedIds,
    ...startedIds
  ]);
  const byId = new Map(details.map((item) => [item.id, item]));

  const pick = (ids: number[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((item): item is InProgressItem => item !== undefined);

  return {
    assigned: pick(assignedIds),
    startedForOthers: pick(startedIds)
  };
}
