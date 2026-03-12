import { defaultSettings } from './defaultSettings';
import type {
  ActiveWorkItemContext,
  ParentSuggestionGroup,
  ParentSuggestionItem,
  ParentSuggestionStore,
  Settings,
  WorkItem,
  WorkItemResult
} from '@/types';
import type { SidepanelTabId } from './Tabs';
import {
  LAST_VISITED_DEVOPS_CONTEXT_KEY,
  parseLastVisitedDevOpsContext,
  type LastVisitedDevOpsContext
} from '../devops/lastVisitedContext';

const CACHED_WORK_ITEMS_KEY = 'cachedWorkItems';
const ACTIVE_SIDEPANEL_TAB_KEY = 'activeSidepanelTab';
const HIDDEN_CHILD_TASK_STATES_KEY = 'hiddenChildTaskStates';
const PARENT_SUGGESTIONS_KEY = 'parentSuggestions';
const PINNED_ACTIVE_WORK_ITEM_CONTEXT_KEY = 'pinnedActiveWorkItemContext';
// Keep enough entries to support recency ordering while only rendering a small subset.
const MAX_STORED_RECENT_SUGGESTIONS = 40;

type PersistedSidepanelTabId = Exclude<SidepanelTabId, 'settings'>;

const EMPTY_PARENT_SUGGESTIONS: ParentSuggestionStore = {
  recentByGroup: {
    parentable: [],
    feature: []
  },
  pinnedIdsByGroup: {
    parentable: [],
    feature: []
  }
};

export async function loadSettings(): Promise<Settings> {
  return chrome.storage.local.get(defaultSettings);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set(settings);
}

export async function loadLastVisitedDevOpsContext(): Promise<LastVisitedDevOpsContext | null> {
  const stored = await chrome.storage.local.get(
    LAST_VISITED_DEVOPS_CONTEXT_KEY
  );
  return parseLastVisitedDevOpsContext(stored[LAST_VISITED_DEVOPS_CONTEXT_KEY]);
}

export async function saveLastVisitedDevOpsContext(
  context: LastVisitedDevOpsContext
): Promise<void> {
  await chrome.storage.local.set({
    [LAST_VISITED_DEVOPS_CONTEXT_KEY]: context
  });
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
  return normalizePersistedSidepanelTabId(value) ?? 'work-items';
}

export async function saveActiveSidepanelTab(
  tabId: SidepanelTabId
): Promise<void> {
  if (!isPersistedSidepanelTabId(tabId)) {
    return;
  }

  await chrome.storage.local.set({ [ACTIVE_SIDEPANEL_TAB_KEY]: tabId });
}

export async function loadHiddenChildTaskStates(): Promise<string[]> {
  const stored = await chrome.storage.local.get(HIDDEN_CHILD_TASK_STATES_KEY);
  const value = stored[HIDDEN_CHILD_TASK_STATES_KEY];
  return isStringArray(value) ? value : [];
}

export async function saveHiddenChildTaskStates(
  states: string[]
): Promise<void> {
  await chrome.storage.local.set({ [HIDDEN_CHILD_TASK_STATES_KEY]: states });
}

export async function loadParentSuggestions(): Promise<ParentSuggestionStore> {
  const stored = await chrome.storage.local.get(PARENT_SUGGESTIONS_KEY);
  const value = stored[PARENT_SUGGESTIONS_KEY];
  return isParentSuggestionStore(value) ? value : EMPTY_PARENT_SUGGESTIONS;
}

export async function upsertParentSuggestion(
  group: ParentSuggestionGroup,
  item: Omit<ParentSuggestionItem, 'lastVisitedAt'>
): Promise<void> {
  const current = await loadParentSuggestions();
  const now = Date.now();
  const pinnedIds = new Set(current.pinnedIdsByGroup[group]);
  const sorted = [
    { ...item, lastVisitedAt: now },
    ...current.recentByGroup[group].filter((entry) => entry.id !== item.id)
  ];

  const pinnedEntries = sorted.filter((entry) => pinnedIds.has(entry.id));
  const dynamicEntries = sorted
    .filter((entry) => !pinnedIds.has(entry.id))
    .slice(0, MAX_STORED_RECENT_SUGGESTIONS);

  const next: ParentSuggestionStore = {
    ...current,
    recentByGroup: {
      ...current.recentByGroup,
      [group]: [...pinnedEntries, ...dynamicEntries]
    }
  };

  await chrome.storage.local.set({ [PARENT_SUGGESTIONS_KEY]: next });
}

export async function setParentSuggestionPinned(
  group: ParentSuggestionGroup,
  workItemId: number,
  isPinned: boolean
): Promise<void> {
  const current = await loadParentSuggestions();
  const pinned = current.pinnedIdsByGroup[group];
  const nextPinned = isPinned
    ? [workItemId, ...pinned.filter((entry) => entry !== workItemId)]
    : pinned.filter((entry) => entry !== workItemId);

  const next: ParentSuggestionStore = {
    ...current,
    pinnedIdsByGroup: {
      ...current.pinnedIdsByGroup,
      [group]: nextPinned
    }
  };

  await chrome.storage.local.set({ [PARENT_SUGGESTIONS_KEY]: next });
}

export async function loadPinnedActiveWorkItemContext(): Promise<ActiveWorkItemContext | null> {
  const stored = await chrome.storage.local.get(
    PINNED_ACTIVE_WORK_ITEM_CONTEXT_KEY
  );
  const value = stored[PINNED_ACTIVE_WORK_ITEM_CONTEXT_KEY];
  return isActiveWorkItemContext(value) ? value : null;
}

export async function savePinnedActiveWorkItemContext(
  context: ActiveWorkItemContext
): Promise<void> {
  await chrome.storage.local.set({
    [PINNED_ACTIVE_WORK_ITEM_CONTEXT_KEY]: context
  });
}

export async function clearPinnedActiveWorkItemContext(): Promise<void> {
  await chrome.storage.local.remove(PINNED_ACTIVE_WORK_ITEM_CONTEXT_KEY);
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

function isPersistedSidepanelTabId(
  value: unknown
): value is PersistedSidepanelTabId {
  return value === 'work-items' || value === 'work-item';
}

function normalizePersistedSidepanelTabId(
  value: unknown
): PersistedSidepanelTabId | null {
  if (value === 'create-task') {
    return 'work-item';
  }

  return isPersistedSidepanelTabId(value) ? value : null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

function isParentSuggestionStore(
  value: unknown
): value is ParentSuggestionStore {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isSuggestionItemArray(value.recentByGroup, 'parentable') &&
    isSuggestionItemArray(value.recentByGroup, 'feature') &&
    isPinnedIdArray(value.pinnedIdsByGroup, 'parentable') &&
    isPinnedIdArray(value.pinnedIdsByGroup, 'feature')
  );
}

function isSuggestionItemArray(
  record: unknown,
  key: ParentSuggestionGroup
): boolean {
  if (!isRecord(record) || !Array.isArray(record[key])) {
    return false;
  }

  return record[key].every(isParentSuggestionItem);
}

function isPinnedIdArray(record: unknown, key: ParentSuggestionGroup): boolean {
  if (!isRecord(record) || !Array.isArray(record[key])) {
    return false;
  }

  return record[key].every((entry) => typeof entry === 'number');
}

function isParentSuggestionItem(value: unknown): value is ParentSuggestionItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.workItemType === 'string' &&
    typeof value.url === 'string' &&
    typeof value.lastVisitedAt === 'number'
  );
}

function isActiveWorkItemContext(
  value: unknown
): value is ActiveWorkItemContext {
  if (!isRecord(value) || !isRecord(value.current)) {
    return false;
  }

  return (
    typeof value.organization === 'string' &&
    typeof value.project === 'string' &&
    (typeof value.parentId === 'number' || value.parentId === null) &&
    typeof value.current.id === 'number' &&
    typeof value.current.title === 'string' &&
    typeof value.current.workItemType === 'string' &&
    typeof value.current.url === 'string'
  );
}
