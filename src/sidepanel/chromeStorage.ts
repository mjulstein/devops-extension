import { defaultSettings } from './defaultSettings';
import type {
  Settings,
  SidepanelTabId,
  WorkItem,
  WorkItemResult
} from './types';

const CACHED_WORK_ITEMS_KEY = 'cachedWorkItems';
const ACTIVE_SIDEPANEL_TAB_KEY = 'activeSidepanelTab';
const HIDDEN_CHILD_TASK_STATES_KEY = 'hiddenChildTaskStates';

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

export async function loadActiveSidepanelTab(): Promise<SidepanelTabId> {
  const stored = await chrome.storage.local.get(ACTIVE_SIDEPANEL_TAB_KEY);
  const value = stored[ACTIVE_SIDEPANEL_TAB_KEY];
  return isSidepanelTabId(value) ? value : 'work-items';
}

export async function saveActiveSidepanelTab(
  tabId: SidepanelTabId
): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_SIDEPANEL_TAB_KEY]: tabId });
}

export async function loadHiddenChildTaskStates(): Promise<string[]> {
  const stored = await chrome.storage.local.get(HIDDEN_CHILD_TASK_STATES_KEY);
  const value = stored[HIDDEN_CHILD_TASK_STATES_KEY];
  return isStringArray(value) ? value : [];
}

export async function saveHiddenChildTaskStates(states: string[]): Promise<void> {
  await chrome.storage.local.set({ [HIDDEN_CHILD_TASK_STATES_KEY]: states });
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

function isSidepanelTabId(value: unknown): value is SidepanelTabId {
  return (
    value === 'settings' || value === 'work-items' || value === 'create-task'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
