import { getWorkItemDetails, isSupportedParentType } from './workItemDetails';
import { isObject } from './typeGuards';
import {
  getOrganizationAndProjectFromUrl,
  getWorkItemIdFromUrl
} from './urlContext';

export async function setParentForActiveWorkItem(
  rawUrl: string,
  selectedParentId: number
): Promise<void> {
  if (!Number.isFinite(selectedParentId) || selectedParentId <= 0) {
    throw new Error('A valid parent work item id is required.');
  }

  const { organization, project } = getOrganizationAndProjectFromUrl(rawUrl);
  const currentWorkItemId = getWorkItemIdFromUrl(rawUrl);

  if (!currentWorkItemId) {
    throw new Error(
      'Could not detect the active work item id from the current URL.'
    );
  }

  if (currentWorkItemId === selectedParentId) {
    throw new Error('A work item cannot be its own parent.');
  }

  const current = await getWorkItemDetails(
    organization,
    project,
    currentWorkItemId
  );
  const selectedParent = await getWorkItemDetails(
    organization,
    project,
    selectedParentId
  );

  validateParentSelection(current.workItemType, selectedParent.workItemType);

  const relationUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${currentWorkItemId}?$expand=relations&api-version=7.0`;

  const relationResponse = await fetch(relationUrl, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!relationResponse.ok) {
    const text = await relationResponse.text();
    throw new Error(
      `Could not inspect current parent relation: HTTP ${relationResponse.status} ${relationResponse.statusText}\n${text}`
    );
  }

  const relationData: unknown = await relationResponse.json();
  const existingParent = findCurrentParentRelation(relationData);

  if (existingParent?.id === selectedParentId) {
    return;
  }

  const selectedParentApiUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workItems/${selectedParentId}`;

  const operations: Array<
    | { op: 'remove'; path: string }
    | { op: 'add'; path: string; value: { rel: string; url: string } }
  > = [];

  if (typeof existingParent?.relationIndex === 'number') {
    operations.push({
      op: 'remove',
      path: `/relations/${existingParent.relationIndex}`
    });
  }

  operations.push({
    op: 'add',
    path: '/relations/-',
    value: {
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url: selectedParentApiUrl
    }
  });

  const patchUrl =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${currentWorkItemId}?api-version=7.0`;

  const patchResponse = await fetch(patchUrl, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json-patch+json'
    },
    body: JSON.stringify(operations)
  });

  if (!patchResponse.ok) {
    const text = await patchResponse.text();
    throw new Error(
      `Could not set parent relation: HTTP ${patchResponse.status} ${patchResponse.statusText}\n${text}`
    );
  }
}

function validateParentSelection(
  currentWorkItemType: string,
  selectedParentType: string
): void {
  const currentType = currentWorkItemType.trim().toLowerCase();
  const parentType = selectedParentType.trim().toLowerCase();

  if (currentType === 'task') {
    if (!isSupportedParentType(selectedParentType)) {
      throw new Error(
        `Task parent must be Bug, Product Backlog Item, PBI, or Improvement. Selected type is "${selectedParentType}".`
      );
    }
    return;
  }

  if (isSupportedParentType(currentWorkItemType)) {
    if (parentType !== 'feature') {
      throw new Error(
        `${currentWorkItemType} parent must be Feature. Selected type is "${selectedParentType}".`
      );
    }
    return;
  }

  throw new Error(
    `Parent assignment is only supported for Task, Bug, Product Backlog Item, PBI, and Improvement. Current type is "${currentWorkItemType}".`
  );
}

function findCurrentParentRelation(data: unknown): {
  relationIndex: number;
  id: number | null;
} | null {
  if (!isObject(data) || !Array.isArray(data.relations)) {
    return null;
  }

  for (
    let relationIndex = 0;
    relationIndex < data.relations.length;
    relationIndex += 1
  ) {
    const relation = data.relations[relationIndex];

    if (!isObject(relation)) {
      continue;
    }

    if (relation.rel !== 'System.LinkTypes.Hierarchy-Reverse') {
      continue;
    }

    if (typeof relation.url !== 'string') {
      return { relationIndex, id: null };
    }

    const match = /\/workItems\/(\d+)$/i.exec(relation.url);
    if (!match) {
      return { relationIndex, id: null };
    }

    const parsed = Number(match[1]);
    return {
      relationIndex,
      id: Number.isFinite(parsed) ? parsed : null
    };
  }

  return null;
}
