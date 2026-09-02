import type { FetchWorkItemsRequest, WorkItem } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';

// Tasks under the configured quick-task parent, in every state. Fetched on its
// own so the tab can refresh after a create without refetching everything else.
export async function fetchQuickTasks(
  request: FetchWorkItemsRequest
): Promise<RuntimeResponse<WorkItem[]>> {
  return chrome.runtime.sendMessage({
    type: 'FETCH_QUICK_TASKS',
    payload: request
  });
}
