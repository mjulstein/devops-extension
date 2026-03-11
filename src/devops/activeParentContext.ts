import type { ActiveWorkItemContext } from '@/types';
import { getWorkItemDetails, isSupportedParentType } from './workItemDetails';
import { getOrganizationAndProjectFromUrl, getWorkItemIdFromUrl } from './urlContext';

export async function resolveActiveWorkItemContext(
  rawUrl: string
): Promise<ActiveWorkItemContext> {
  const { organization, project } = getOrganizationAndProjectFromUrl(rawUrl);
  const workItemId = getWorkItemIdFromUrl(rawUrl);

  if (!workItemId) {
    throw new Error(
      'Could not detect a work item id from the current page. Open a Bug, PBI, or Improvement work item first.'
    );
  }

  const current = await getWorkItemDetails(organization, project, workItemId);

  if (isSupportedParentType(current.workItemType)) {
    return { organization, project, parentId: workItemId };
  }

  if (current.workItemType.toLowerCase() !== 'task') {
    throw new Error(
      `Current item type is "${current.workItemType}". Only Bug, Product Backlog Item, PBI, or Improvement can be a parent.`
    );
  }

  if (!current.parentId) {
    throw new Error(`Current item is Task #${workItemId} and has no parent work item.`);
  }

  const parent = await getWorkItemDetails(organization, project, current.parentId);

  if (!isSupportedParentType(parent.workItemType)) {
    throw new Error(
      `Current item is Task #${workItemId}, but its parent type is "${parent.workItemType}". Parent must be Bug, Product Backlog Item, PBI, or Improvement.`
    );
  }

  return { organization, project, parentId: current.parentId };
}

