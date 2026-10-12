// Fetching the parentless work items, and parenting several at once.
//
// The "has no parent" test is done here rather than in WIQL. `System.Parent` is
// queryable, but what an empty one compares equal to differs between accounts
// and process templates, and a query that silently returns nothing looks exactly
// like having no orphans. Asking for everything you raised of these types and
// filtering on the field that came back is slower and always right.

import { authFetch } from './authFetch';
import { isObject } from './typeGuards';
import {
  ORPHAN_WORK_ITEM_TYPES,
  type OrphanCandidate
} from './orphanWorkItems';

const FIELDS = [
  'System.Id',
  'System.Title',
  'System.WorkItemType',
  'System.State',
  'System.Parent'
] as const;

/** How many to ask about. The batch endpoint refuses more than 200 at a time. */
const BATCH = 200;

function base(organization: string, project: string): string {
  return `https://dev.azure.com/${encodeURIComponent(
    organization
  )}/${encodeURIComponent(project)}`;
}

/**
 * Everything of these types that the signed-in user raised.
 *
 * `@Me` rather than a name: the user's identity is the browser session's, and
 * writing it down anywhere is the thing this project does not do. Closed items
 * are left in — an orphan that is already done still distorts a rollup, and the
 * view can say what state it is in.
 */
function buildOrphanWiql(): string {
  const types = ORPHAN_WORK_ITEM_TYPES.map((type) => `'${type}'`).join(', ');
  return [
    'SELECT [System.Id] FROM WorkItems',
    'WHERE [System.TeamProject] = @project',
    'AND [System.CreatedBy] = @Me',
    `AND [System.WorkItemType] IN (${types})`,
    'ORDER BY [System.ChangedDate] DESC'
  ].join(' ');
}

export async function fetchOrphanCandidates(
  organization: string,
  project: string
): Promise<OrphanCandidate[]> {
  const wiqlResponse = await authFetch(
    `${base(organization, project)}/_apis/wit/wiql?api-version=7.0`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: buildOrphanWiql() })
    }
  );

  if (!wiqlResponse.ok) {
    const text = await wiqlResponse.text();
    throw new Error(
      `Could not list your work items: HTTP ${wiqlResponse.status} ${wiqlResponse.statusText}\n${text}`
    );
  }

  const ids = extractIds(await wiqlResponse.json());
  if (ids.length === 0) {
    return [];
  }

  const candidates: OrphanCandidate[] = [];
  for (let index = 0; index < ids.length; index += BATCH) {
    candidates.push(
      ...(await fetchBatch(
        organization,
        project,
        ids.slice(index, index + BATCH)
      ))
    );
  }
  return candidates;
}

async function fetchBatch(
  organization: string,
  project: string,
  ids: number[]
): Promise<OrphanCandidate[]> {
  const url =
    `${base(organization, project)}/_apis/wit/workitems?ids=${ids.join(',')}` +
    `&fields=${encodeURIComponent(FIELDS.join(','))}&api-version=7.0`;

  const response = await authFetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Could not read your work items: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  return parseCandidates(await response.json(), organization, project);
}

export function parseCandidates(
  data: unknown,
  organization: string,
  project: string
): OrphanCandidate[] {
  if (!isObject(data) || !Array.isArray(data.value)) {
    return [];
  }

  const items: OrphanCandidate[] = [];
  for (const entry of data.value) {
    if (!isObject(entry) || !isObject(entry.fields)) {
      continue;
    }
    const id = Number(entry.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    const parent = entry.fields['System.Parent'];
    items.push({
      id,
      title: asText(entry.fields['System.Title']),
      workItemType: asText(entry.fields['System.WorkItemType']),
      state: asText(entry.fields['System.State']),
      parentId: typeof parent === 'number' ? parent : null,
      url: `${base(organization, project)}/_workitems/edit/${id}`
    });
  }
  return items;
}

/** A field as text, and nothing but text: anything else reads as absent. */
function asText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';
}

function extractIds(data: unknown): number[] {
  if (!isObject(data) || !Array.isArray(data.workItems)) {
    return [];
  }
  return data.workItems
    .map((entry) => (isObject(entry) ? Number(entry.id) : Number.NaN))
    .filter((id) => Number.isFinite(id));
}

export interface BulkParentOutcome {
  parented: number[];
  failed: { id: number; reason: string }[];
}

/**
 * Parents each item under the same work item, one call each.
 *
 * In sequence, not in parallel: a burst of writes against the same parent is
 * how an account finds its rate limit, and this is a tidying job nobody is
 * waiting on. A failure is recorded and the rest continue, because stopping at
 * the first one would leave the user guessing which half went through.
 */
export async function parentWorkItems(
  organization: string,
  project: string,
  ids: number[],
  parentId: number
): Promise<BulkParentOutcome> {
  const outcome: BulkParentOutcome = { parented: [], failed: [] };
  const parentUrl = `${base(organization, project)}/_apis/wit/workItems/${parentId}`;

  for (const id of ids) {
    try {
      const response = await authFetch(
        `${base(organization, project)}/_apis/wit/workitems/${id}?api-version=7.0`,
        {
          method: 'PATCH',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json-patch+json'
          },
          body: JSON.stringify([
            {
              op: 'add',
              path: '/relations/-',
              value: {
                rel: 'System.LinkTypes.Hierarchy-Reverse',
                url: parentUrl
              }
            }
          ])
        }
      );

      if (response.ok) {
        outcome.parented.push(id);
      } else {
        outcome.failed.push({
          id,
          reason: `HTTP ${response.status} ${response.statusText}`
        });
      }
    } catch (cause) {
      outcome.failed.push({
        id,
        reason: cause instanceof Error ? cause.message : String(cause)
      });
    }
  }

  return outcome;
}
