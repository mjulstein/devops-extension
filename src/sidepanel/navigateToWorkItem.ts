import { getWorkItemIdFromUrl } from '@/devops/urlContext';

export type WorkItemNavigationResult =
  | 'active-tab'
  | 'existing-tab'
  | 'new-tab';

export async function navigateToWorkItem(
  url: string,
  external = false
): Promise<WorkItemNavigationResult> {
  if (!external) {
    await navigateActiveTab(url);
    return 'active-tab';
  }

  try {
    const workItemId = getWorkItemIdFromUrl(url);

    if (workItemId) {
      const tabs = await chrome.tabs.query({});
      const match = tabs.find((tab) => {
        if (!tab.url) {
          return false;
        }

        return getWorkItemIdFromUrl(tab.url) === workItemId;
      });

      if (match && typeof match.id === 'number') {
        try {
          await chrome.windows.update(match.windowId, { focused: true });
        } catch {
          // Ignore best-effort window focus failures.
        }

        await chrome.tabs.update(match.id, { active: true });
        return 'existing-tab';
      }
    }

    await chrome.tabs.create({ url });
    return 'new-tab';
  } catch {
    await chrome.tabs.create({ url });
    return 'new-tab';
  }
}

async function navigateActiveTab(url: string): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return;
  }

  await chrome.tabs.update(tab.id, { url });
}
