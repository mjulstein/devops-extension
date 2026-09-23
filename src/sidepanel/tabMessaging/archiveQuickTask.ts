import type { Settings } from '@/types';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

// Moves a finished quick task under the configured archive work item, which
// takes it out of the Quick list without losing it.
export async function archiveQuickTask(
  settings: Settings,
  taskId: number
): Promise<RuntimeResponse<number>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'ARCHIVE_QUICK_TASK',
      payload: { settings, taskId }
    }),
    'ARCHIVE_QUICK_TASK'
  );
}
