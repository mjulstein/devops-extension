import type { FetchWorkItemsRequest, WorkItem } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';

// Fetched on demand when "show task parent details" is switched on, because it
// needs the child states of every parent involved — too expensive to pay for on
// every work-item load when the toggle is usually off.
export async function fetchClosedParentRollup(
  request: FetchWorkItemsRequest
): Promise<RuntimeResponse<WorkItem[]>> {
  return chrome.runtime.sendMessage({
    type: 'FETCH_CLOSED_PARENT_ROLLUP',
    payload: request
  });
}
