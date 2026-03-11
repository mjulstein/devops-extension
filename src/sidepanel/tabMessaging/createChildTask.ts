import type { CreatedChildTask } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';
import { sendMessageToActiveTab } from './sendMessageToActiveTab';

export async function createChildTask(
  title: string,
  preferredParentId?: number
): Promise<RuntimeResponse<CreatedChildTask>> {
  return sendMessageToActiveTab<RuntimeResponse<CreatedChildTask>>({
    type: 'CREATE_CHILD_TASK',
    payload: { title, preferredParentId }
  });
}
