import type { ActiveWorkItemContext } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';

export async function getActiveWorkItemContext(
  forceResync = false
): Promise<RuntimeResponse<ActiveWorkItemContext>> {
  return chrome.runtime.sendMessage({
    type: 'GET_ACTIVE_WORK_ITEM_CONTEXT',
    payload: { forceResync }
  });
}
