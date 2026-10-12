import { getWorkItemDetails } from './workItemDetails';
import { describeParentMismatch } from './orphanWorkItems';
import { isObject } from './typeGuards';
import {
  getOrganizationAndProjectFromUrl,
  getWorkItemIdFromUrl
} from './urlContext';
import { authFetch } from './authFetch';

export async function setParentForActiveWorkItem(
  rawUrl: string,
  selectedParentId: number,
  targetWorkItemId?: number
): Promise<void> {
  if (!Number.isFinite(selectedParentId) || selectedParentId <= 0) {
    throw new Error('A valid parent work item id is required.');
  }

  const { organization, project } = getOrganizationAndProjectFromUrl(rawUrl);
  const currentWorkItemId =
    typeof targetWorkItemId === 'number' && targetWorkItemId > 0
      ? targetWorkItemId
      : getWorkItemIdFromUrl(rawUrl);

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

  const relationResponse = await authFetch(relationUrl, {
    method: 'GET',
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

  const operations: (
    | { op: 'remove'; path: string }
    | { op: 'add'; path: string; value: { rel: string; url: string } }
  )[] = [];

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

  const patchResponse = await authFetch(patchUrl, {
    method: 'PATCH',
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

/**
 * The hierarchy's rule, borrowed rather than restated.
 *
 * It lives in `orphanWorkItems.ts` because the bulk view needs it before it
 * sends anything; keeping a second copy here is how the two would come to
 * disagree about what is legal.
 */
function validateParentSelection(
  currentWorkItemType: string,
  selectedParentType: string
): void {
  const mismatch = describeParentMismatch(
    currentWorkItemType,
    selectedParentType
  );
  if (mismatch !== null) {
    throw new Error(mismatch.replace('#PARENT#', 'The selected parent'));
  }
}

function findCurrentParentRelation(data: unknown): {
  relationIndex: number;
  id: number | null;
} | null {
  if (!isObject(data) || !Array.isArray(data.relations)) {
    return null;
  }

  const relations = data.relations as unknown[];

  for (
    let relationIndex = 0;
    relationIndex < relations.length;
    relationIndex += 1
  ) {
    const relation = relations[relationIndex];

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
