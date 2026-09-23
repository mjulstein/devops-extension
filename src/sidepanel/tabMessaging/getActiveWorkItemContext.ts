import type { ActiveWorkItemContext } from '@/types';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

export async function getActiveWorkItemContext(
  forceResync = false
): Promise<RuntimeResponse<ActiveWorkItemContext>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT',
      payload: { forceResync }
    }),
    'GET_ACTIVE_WORK_ITEM_CONTEXT'
  );
}
