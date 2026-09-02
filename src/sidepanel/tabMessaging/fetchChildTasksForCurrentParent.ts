import type { ChildTaskItem } from '@/types';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

export async function fetchChildTasksForCurrentParent(
  preferredParentId?: number
): Promise<RuntimeResponse<ChildTaskItem[]>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT',
      payload: { preferredParentId }
    }),
    'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT'
  );
}
