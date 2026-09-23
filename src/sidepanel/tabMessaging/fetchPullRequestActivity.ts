import type { FetchWorkItemsRequest, PullRequestActivityItem } from '@/types';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

// Fetched on demand when the PRs tab is first opened: it scans the comment
// threads of every candidate pull request, so it must not sit on the path that
// renders the work-item lists.
export async function fetchPullRequestActivity(
  request: FetchWorkItemsRequest
): Promise<RuntimeResponse<PullRequestActivityItem[]>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'FETCH_PULL_REQUEST_ACTIVITY',
      payload: request
    }),
    'FETCH_PULL_REQUEST_ACTIVITY'
  );
}
