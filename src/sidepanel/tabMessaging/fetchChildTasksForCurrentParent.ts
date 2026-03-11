import type { ChildTaskItem } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';
import { sendMessageToActiveTab } from './sendMessageToActiveTab';

export async function fetchChildTasksForCurrentParent(
  preferredParentId?: number
): Promise<RuntimeResponse<ChildTaskItem[]>> {
  return sendMessageToActiveTab<RuntimeResponse<ChildTaskItem[]>>({
    type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT',
    payload: { preferredParentId }
  });
}
