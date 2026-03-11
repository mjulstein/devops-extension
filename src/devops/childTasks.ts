import type { ChildTaskItem } from '@/types';
import { resolveActiveWorkItemContext } from './activeParentContext';
import { isObject } from './typeGuards';

export async function fetchChildTasksForActiveParent(
  rawUrl: string
): Promise<ChildTaskItem[]> {
  const context = await resolveActiveWorkItemContext(rawUrl);
  const relationUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    `/_apis/wit/workitems/${context.parentId}?$expand=relations&api-version=7.0`;

  const relationResponse = await fetch(relationUrl, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!relationResponse.ok) {
    const text = await relationResponse.text();
    throw new Error(
      `Could not load child-task links: HTTP ${relationResponse.status} ${relationResponse.statusText}\n${text}`
    );
  }

  const relationData: unknown = await relationResponse.json();
  const childIds = extractChildIdsFromRelations(relationData);

  if (!childIds.length) {
    return [];
  }

  const items = await fetchTaskItemsByIds(
    context.organization,
    context.project,
    childIds,
    context.parentId
  );

  return items.sort(compareChildTasks);
}

async function fetchTaskItemsByIds(
  organization: string,
  project: string,
  childIds: number[],
  parentId: number
): Promise<ChildTaskItem[]> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems?ids=${childIds.join(',')}` +
    `&fields=${encodeURIComponent('System.Id,System.Title,System.State,System.WorkItemType')}` +
    '&api-version=7.0';

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Could not load child-task details: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data: unknown = await response.json();
  if (!isObject(data) || !Array.isArray(data.value)) {
    return [];
  }

  const items: ChildTaskItem[] = [];

  for (const value of data.value) {
    if (!isObject(value) || !isObject(value.fields)) {
      continue;
    }

    const id = value.fields['System.Id'];
    const title = value.fields['System.Title'];
    const state = value.fields['System.State'];
    const workItemType = value.fields['System.WorkItemType'];

    if (
      typeof id !== 'number' ||
      typeof title !== 'string' ||
      typeof state !== 'string' ||
      typeof workItemType !== 'string' ||
      workItemType.toLowerCase() !== 'task'
    ) {
      continue;
    }

    items.push({
      id,
      title,
      state,
      parentId,
      url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`
    });
  }

  return items;
}

function extractChildIdsFromRelations(data: unknown): number[] {
  if (!isObject(data) || !Array.isArray(data.relations)) {
    return [];
  }

  const ids: number[] = [];

  for (const relation of data.relations) {
    if (!isObject(relation)) {
      continue;
    }

    if (relation.rel !== 'System.LinkTypes.Hierarchy-Forward') {
      continue;
    }

    if (typeof relation.url !== 'string') {
      continue;
    }

    const idMatch = /\/workItems\/(\d+)$/i.exec(relation.url);
    if (!idMatch) {
      continue;
    }

    const parsed = Number(idMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      ids.push(parsed);
    }
  }

  return ids;
}

function compareChildTasks(left: ChildTaskItem, right: ChildTaskItem): number {
  return (
    getStateSortWeight(left.state) - getStateSortWeight(right.state) ||
    left.state.localeCompare(right.state) ||
    right.id - left.id
  );
}

function getStateSortWeight(state: string): number {
  const normalized = state.trim().toLowerCase();
  return normalized === 'to do' || normalized === 'todo' || normalized === 'new'
    ? 0
    : 1;
}

