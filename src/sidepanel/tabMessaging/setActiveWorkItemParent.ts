import type { RuntimeResponse } from './runtimeResponse';

export async function setActiveWorkItemParent(
  parentId: number,
  targetWorkItemId?: number
): Promise<RuntimeResponse<null>> {
  return chrome.runtime.sendMessage({
    type: 'SET_ACTIVE_WORK_ITEM_PARENT',
    payload: { parentId, targetWorkItemId }
  });
}
