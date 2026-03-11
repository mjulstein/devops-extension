import type { ActiveWorkItemContext } from '@/types';
import { getWorkItemDetails, isSupportedParentType } from './workItemDetails';
import {
  getOrganizationAndProjectFromUrl,
  getWorkItemIdFromUrl
} from './urlContext';

export async function resolveActiveWorkItemContext(
  rawUrl: string,
  preferredParentId?: number,
  activeWorkItemIdOverride?: number
): Promise<ActiveWorkItemContext> {
  const { organization, project } = getOrganizationAndProjectFromUrl(rawUrl);
  const workItemId =
    typeof activeWorkItemIdOverride === 'number' && activeWorkItemIdOverride > 0
      ? activeWorkItemIdOverride
      : getWorkItemIdFromUrl(rawUrl);

  if (!workItemId) {
    throw new Error(
      'Could not detect a work item id from the current page. Open a work item first.'
    );
  }

  const current = await getWorkItemDetails(organization, project, workItemId);

  const context: ActiveWorkItemContext = {
    organization,
    project,
    parentId: null,
    current: {
      id: workItemId,
      title: current.title,
      workItemType: current.workItemType,
      url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${workItemId}`
    }
  };

  if (typeof preferredParentId === 'number' && preferredParentId > 0) {
    const preferredParent = await getWorkItemDetails(
      organization,
      project,
      preferredParentId
    );

    if (!isSupportedParentType(preferredParent.workItemType)) {
      throw new Error(
        `Selected parent #${preferredParentId} has type "${preferredParent.workItemType}" and cannot be used as a task parent.`
      );
    }

    context.parentId = preferredParentId;
    return context;
  }

  if (isSupportedParentType(current.workItemType)) {
    context.parentId = workItemId;
    return context;
  }

  if (current.workItemType.trim().toLowerCase() === 'task') {
    if (!current.parentId) {
      return context;
    }

    const parent = await getWorkItemDetails(
      organization,
      project,
      current.parentId
    );
    if (isSupportedParentType(parent.workItemType)) {
      context.parentId = current.parentId;
    }
  }

  return context;
}
