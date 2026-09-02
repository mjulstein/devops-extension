import type { Settings } from '@/types';
import type { CreatedQuickTask } from '@/devops/quickTask';
import type { RuntimeResponse } from './runtimeResponse';

// Turns the active page into a task under the configured catch-all work item.
// The page title and URL are read in the side panel and passed along, so the
// task records the page that was actually open when the button was clicked.
export async function createQuickTask(
  settings: Settings,
  pageTitle: string,
  pageUrl: string,
  title?: string
): Promise<RuntimeResponse<CreatedQuickTask>> {
  return chrome.runtime.sendMessage({
    type: 'CREATE_QUICK_TASK',
    payload: { settings, pageTitle, pageUrl, title }
  });
}
