import type { RuntimeResponse, Settings, WorkItemResult } from "./types";

export async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return tab.id;
}

export async function pingPage() {
  const tabId = await getActiveTabId();
  return chrome.tabs.sendMessage(tabId, { type: "PING_PAGE" });
}

export async function testAzdoApi() {
  const tabId = await getActiveTabId();
  return chrome.tabs.sendMessage(tabId, { type: "TEST_AZDO_API" });
}

export async function fetchWorkItems(settings: Settings): Promise<RuntimeResponse<WorkItemResult>> {
  const tabId = await getActiveTabId();
  return chrome.tabs.sendMessage(tabId, {
    type: "FETCH_WORK_ITEMS",
    payload: settings
  });
}
