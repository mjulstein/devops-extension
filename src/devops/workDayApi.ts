// The calls behind the last-working-day dashboard.
//
// One WIQL query for candidates, then each candidate's `/updates` (one call
// apiece — the expensive part, so run a few at a time), then one batch read for
// the current facts the rows and loose ends need. Everything goes through the
// runtime PAT via `authFetch`.

import { authFetch } from './authFetch';
import { isObject } from './typeGuards';
import { queryIds, resolveIdentity } from './inProgressByMeApi';
import {
  addDays,
  buildActivityWiql,
  dayKey,
  extractChanges,
  type ActivityChange,
  type DayRange,
  type ItemNow
} from './workDay';

export interface ActivityItem extends ItemNow {
  title: string;
  workItemType: string;
  url: string;
}

export interface WindowActivity {
  /** Who the changes were matched against. Empty when it could not be resolved. */
  identity: string;
  /** The user's changes inside the range. */
  changes: ActivityChange[];
  /** Current facts for every item with a change in the range. */
  items: ActivityItem[];
}

const FIELDS = [
  'System.Title',
  'System.WorkItemType',
  'System.TeamProject',
  'System.State',
  'System.AssignedTo',
  'System.Parent'
] as const;

const BATCH = 200;
const CONCURRENCY = 6;

function orgBase(organization: string): string {
  return `https://dev.azure.com/${encodeURIComponent(organization)}`;
}

async function fetchUpdates(
  organization: string,
  id: number
): Promise<unknown> {
  const response = await authFetch(
    `${orgBase(organization)}/_apis/wit/workitems/${id}/updates?api-version=7.1`,
    { method: 'GET', headers: { Accept: 'application/json' } }
  );
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  return isObject(data) ? data.value : null;
}

/** Runs `task` over `inputs`, a few at a time, keeping going past failures. */
async function mapLimited<T, R>(
  inputs: T[],
  task: (input: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const input = inputs[next++];
      try {
        results.push(await task(input));
      } catch {
        // One unreadable history should not take the rest with it.
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function asText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';
}

export function parseItems(
  data: unknown,
  organization: string
): ActivityItem[] {
  if (!isObject(data) || !Array.isArray(data.value)) {
    return [];
  }
  const items: ActivityItem[] = [];
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
    const parent = Number(fields['System.Parent']);
    const project = asText(fields['System.TeamProject']);
    items.push({
      id,
      title: asText(fields['System.Title']),
      workItemType: asText(fields['System.WorkItemType']),
      state: asText(fields['System.State']),
      assignedTo: isObject(assigned) ? asText(assigned.uniqueName) : '',
      parentId: Number.isFinite(parent) && parent > 0 ? parent : null,
      url: `${orgBase(organization)}/${encodeURIComponent(project)}/_workitems/edit/${id}`
    });
  }
  return items;
}

async function fetchItems(
  organization: string,
  ids: number[]
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];
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
    items.push(...parseItems(await response.json(), organization));
  }
  return items;
}

export async function fetchWindowActivity(
  organization: string,
  project: string,
  assignedTo: string,
  range: DayRange
): Promise<WindowActivity> {
  const identity = await resolveIdentity(organization, assignedTo);
  if (identity === '') {
    return { identity, changes: [], items: [] };
  }

  const ids = await queryIds(
    organization,
    project,
    // A day early: WIQL compares dates in the server's zone, not the
    // browser's, and the filter below trims the extra back off.
    buildActivityWiql(assignedTo, addDays(range.from, -1))
  );

  const perItem = await mapLimited(ids, async (id) =>
    extractChanges(id, await fetchUpdates(organization, id), identity)
  );

  // Kept to the range on local day keys, the same bucketing the page uses.
  const changes = perItem.flat().filter((change) => {
    const day = dayKey(new Date(change.at));
    return day >= range.from && day <= range.to;
  });

  const touched = [...new Set(changes.map((change) => change.id))];
  const items =
    touched.length > 0 ? await fetchItems(organization, touched) : [];

  return { identity, changes, items };
}
