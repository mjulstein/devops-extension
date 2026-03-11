import type { ActiveWorkItemContext } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';
import { sendMessageToActiveTab } from './sendMessageToActiveTab';

export async function getActiveWorkItemContext(
  forceResync = false
): Promise<RuntimeResponse<ActiveWorkItemContext>> {
  return sendMessageToActiveTab<RuntimeResponse<ActiveWorkItemContext>>({
    type: 'GET_ACTIVE_WORK_ITEM_CONTEXT',
    payload: { forceResync }
  });
}
