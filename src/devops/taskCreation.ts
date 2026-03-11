import type { CreatedChildTask } from '@/types';
import { resolveActiveWorkItemContext } from './activeParentContext';
import { getNumericIdFromResponse } from './typeGuards';
import { getWorkItemDetails } from './workItemDetails';

export async function createChildTaskFromActivePage(
  rawTitle: string,
  rawUrl: string,
  preferredParentId?: number
): Promise<CreatedChildTask> {
  const title = rawTitle.trim();

  if (!title) {
    throw new Error('Enter a task title before creating.');
  }

  const context = await resolveActiveWorkItemContext(rawUrl, preferredParentId);

  if (!context.parentId) {
    throw new Error('No parent work item is selected or detected for task creation.');
  }

  const parentDetails = await getWorkItemDetails(
    context.organization,
    context.project,
    context.parentId
  );

  const parentApiUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    `/_apis/wit/workItems/${context.parentId}`;

  const patchOperations: {
    op: 'add';
    path: string;
    value: string | { rel: string; url: string };
  }[] = [
    { op: 'add', path: '/fields/System.Title', value: title }
  ];

  if (parentDetails.areaPath) {
    patchOperations.push({
      op: 'add',
      path: '/fields/System.AreaPath',
      value: parentDetails.areaPath
    });
  }

  if (parentDetails.iterationPath) {
    patchOperations.push({
      op: 'add',
      path: '/fields/System.IterationPath',
      value: parentDetails.iterationPath
    });
  }

  patchOperations.push({
    op: 'add',
    path: '/relations/-',
    value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: parentApiUrl }
  });

  const createUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    '/_apis/wit/workitems/$Task?api-version=7.0';

  const response = await fetch(createUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json-patch+json'
    },
    body: JSON.stringify(patchOperations)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Task creation failed: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data: unknown = await response.json();
  const id = getNumericIdFromResponse(data);

  if (!id) {
    throw new Error('Task created but response did not include a valid id.');
  }

  return {
    id,
    title,
    parentId: context.parentId,
    url: `https://dev.azure.com/${context.organization}/${context.project}/_workitems/edit/${id}`
  };
}
