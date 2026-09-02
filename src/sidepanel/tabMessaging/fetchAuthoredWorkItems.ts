import type { FetchWorkItemsRequest, WorkItem } from '@/types';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

// Authored items are fetched on demand, when the Authored tab is first opened,
// rather than as part of the main work-item load — the TODO list is what the
// panel is for, and it should not wait on a second query.
export async function fetchAuthoredWorkItems(
  request: FetchWorkItemsRequest
): Promise<RuntimeResponse<WorkItem[]>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'FETCH_AUTHORED_WORK_ITEMS',
      payload: request
    }),
    'FETCH_AUTHORED_WORK_ITEMS'
  );
}
