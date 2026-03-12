import type { ChildTaskItem } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';

export async function fetchChildTasksForCurrentParent(
  preferredParentId?: number
): Promise<RuntimeResponse<ChildTaskItem[]>> {
  return chrome.runtime.sendMessage({
    type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT',
    payload: { preferredParentId }
  });
}
