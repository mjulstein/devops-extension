import type { Settings } from '@/types';
import type { InProgressByMe } from '@/devops/inProgressByMe';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

// The second reading of the Orphans tab. On demand only: it confirms each
// candidate against that work item's own history, which is one call apiece and
// not something to do on the path that renders the other lists.
export async function fetchInProgressByMe(
  settings: Settings,
  state: string
): Promise<RuntimeResponse<InProgressByMe>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'FETCH_IN_PROGRESS_BY_ME',
      payload: { settings, state }
    }),
    'FETCH_IN_PROGRESS_BY_ME'
  );
}
