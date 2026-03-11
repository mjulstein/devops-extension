import type {
  ActiveWorkItemContext,
  CreatedChildTask,
  RuntimeResponse,
  Settings,
  WorkItemResult
} from './types';

const NO_RECEIVER_ERROR =
  'Could not establish connection. Receiving end does not exist.';

export async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('No active tab found.');
  }

  return tab.id;
}

async function sendMessageToActiveTab<T>(message: unknown): Promise<T> {
  const tabId = await getActiveTabId();

  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes(NO_RECEIVER_ERROR)) {
      throw new Error(
        'Extension reloaded. Refresh the active Azure DevOps tab, then try again.'
      );
    }

    throw error instanceof Error
      ? error
      : new Error(errorMessage, { cause: error });
  }
}

export async function fetchWorkItems(
  settings: Settings
): Promise<RuntimeResponse<WorkItemResult>> {
  return sendMessageToActiveTab<RuntimeResponse<WorkItemResult>>({
    type: 'FETCH_WORK_ITEMS',
    payload: settings
  });
}

export async function getActiveWorkItemContext(): Promise<
  RuntimeResponse<ActiveWorkItemContext>
> {
  return sendMessageToActiveTab<RuntimeResponse<ActiveWorkItemContext>>({
    type: 'GET_ACTIVE_WORK_ITEM_CONTEXT'
  });
}

export async function createChildTask(
  title: string
): Promise<RuntimeResponse<CreatedChildTask>> {
  return sendMessageToActiveTab<RuntimeResponse<CreatedChildTask>>({
    type: 'CREATE_CHILD_TASK',
    payload: { title }
  });
}
