import type { CreatedChildTask } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';

export async function createChildTask(
  title: string,
  preferredParentId?: number
): Promise<RuntimeResponse<CreatedChildTask>> {
  return chrome.runtime.sendMessage({
    type: 'CREATE_CHILD_TASK',
    payload: { title, preferredParentId }
  });
}
