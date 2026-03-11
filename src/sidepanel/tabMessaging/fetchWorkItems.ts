import type { Settings, WorkItemResult } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';
import { sendMessageToActiveTab } from './sendMessageToActiveTab';

export async function fetchWorkItems(
  settings: Settings
): Promise<RuntimeResponse<WorkItemResult>> {
  return sendMessageToActiveTab<RuntimeResponse<WorkItemResult>>({
    type: 'FETCH_WORK_ITEMS',
    payload: settings
  });
}
