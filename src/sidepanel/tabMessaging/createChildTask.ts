import type { CreatedChildTask } from '@/types';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

export async function createChildTask(
  title: string,
  preferredParentId?: number
): Promise<RuntimeResponse<CreatedChildTask>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'CREATE_CHILD_TASK',
      payload: { title, preferredParentId }
    }),
    'CREATE_CHILD_TASK'
  );
}
