import { defaultSettings } from './defaultSettings';
import type { Settings, WorkItem, WorkItemResult } from './types';

const CACHED_WORK_ITEMS_KEY = 'cachedWorkItems';

export async function loadSettings(): Promise<Settings> {
  return chrome.storage.local.get(defaultSettings);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set(settings);
}

export async function loadCachedWorkItems(): Promise<WorkItemResult | null> {
  const stored = await chrome.storage.local.get(CACHED_WORK_ITEMS_KEY);
  const cached = stored[CACHED_WORK_ITEMS_KEY];
  return isWorkItemResult(cached) ? cached : null;
}

export async function saveCachedWorkItems(
  result: WorkItemResult
): Promise<void> {
  await chrome.storage.local.set({ [CACHED_WORK_ITEMS_KEY]: result });
}

function isWorkItemResult(value: unknown): value is WorkItemResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.count === 'number' &&
    Array.isArray(value.openItems) &&
    Array.isArray(value.closedItems) &&
    value.openItems.every(isWorkItem) &&
    value.closedItems.every(isWorkItem)
  );
}

function isWorkItem(value: unknown): value is WorkItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'number' &&
    typeof value.workItemType === 'string' &&
    typeof value.title === 'string' &&
    typeof value.state === 'string' &&
    typeof value.assignedTo === 'string' &&
    (typeof value.parentId === 'number' || value.parentId === null) &&
    (typeof value.closedDate === 'string' || value.closedDate === null) &&
    typeof value.url === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
