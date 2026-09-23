import { authFetch } from './authFetch';
import { isObject } from './typeGuards';

// Moving a work item under a different parent. Azure DevOps has no "set parent"
// field: the hierarchy is a relation, so the old Hierarchy-Reverse link has to
// be removed by index and a new one added in the same patch.

export interface ParentRelation {
  id: number;
  /** Index in the item's `relations` array, needed to remove it. */
  index: number;
}

/** Finds the item's current parent relation, if it has one. */
export function findParentRelation(data: unknown): ParentRelation | null {
  if (!isObject(data) || !Array.isArray(data.relations)) {
    return null;
  }

  for (const [index, relation] of data.relations.entries()) {
    if (
      !isObject(relation) ||
      relation.rel !== 'System.LinkTypes.Hierarchy-Reverse' ||
      typeof relation.url !== 'string'
    ) {
      continue;
    }
    const match = /\/workItems\/(\d+)$/i.exec(relation.url);
    if (!match) {
      continue;
    }
    const id = Number(match[1]);
    if (Number.isInteger(id)) {
      return { id, index };
    }
  }

  return null;
}

/**
 * Repoints a work item at a new parent. A no-op when it is already there, so
 * callers can be careless about repeating it.
 */
export async function reparentWorkItem(
  organization: string,
  project: string,
  workItemId: number,
  newParentId: number
): Promise<void> {
  if (!Number.isInteger(newParentId) || newParentId <= 0) {
    throw new Error('A valid parent work item id is required.');
  }
  if (workItemId === newParentId) {
    throw new Error('A work item cannot be its own parent.');
  }

  const base =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${workItemId}`;

  const current = await authFetch(`${base}?$expand=relations&api-version=7.0`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (!current.ok) {
    const text = await current.text();
    throw new Error(
      `Could not inspect current parent relation: HTTP ${current.status} ${current.statusText}\n${text}`
    );
  }

  const existing = findParentRelation(await current.json());
  if (existing?.id === newParentId) {
    return;
  }

  const operations: (
    | { op: 'remove'; path: string }
    | { op: 'add'; path: string; value: { rel: string; url: string } }
  )[] = [];

  if (existing) {
    operations.push({ op: 'remove', path: `/relations/${existing.index}` });
  }

  operations.push({
    op: 'add',
    path: '/relations/-',
    value: {
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url:
        `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
        `/_apis/wit/workItems/${newParentId}`
    }
  });

  const patch = await authFetch(`${base}?api-version=7.0`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json-patch+json'
    },
    body: JSON.stringify(operations)
  });

  if (!patch.ok) {
    const text = await patch.text();
    throw new Error(
      `Could not set parent relation: HTTP ${patch.status} ${patch.statusText}\n${text}`
    );
  }
}
