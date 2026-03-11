import type { RuntimeResponse } from './runtimeResponse';
import { sendMessageToActiveTab } from './sendMessageToActiveTab';

export async function setActiveWorkItemParent(
  parentId: number
): Promise<RuntimeResponse<null>> {
  return sendMessageToActiveTab<RuntimeResponse<null>>({
    type: 'SET_ACTIVE_WORK_ITEM_PARENT',
    payload: { parentId }
  });
}
