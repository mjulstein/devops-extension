import { useEffect, useMemo, useState } from 'react';
import { SettingsCard } from './settings';
import { WorkItemCard } from './work-item';
import { StatusCard } from './work-items';
import { Tabs, type SidepanelTabId } from './Tabs';
import {
  clearPinnedActiveWorkItemContext,
  loadActiveSidepanelTab,
  loadCachedWorkItems,
  loadHiddenChildTaskStates,
  loadParentSuggestions,
  loadPinnedActiveWorkItemContext,
  loadSettings,
  saveActiveSidepanelTab,
  saveCachedWorkItems,
  saveHiddenChildTaskStates,
  savePinnedActiveWorkItemContext,
  saveSettings,
  setParentSuggestionPinned,
  upsertParentSuggestion
} from './chromeStorage';
import { defaultSettings } from './defaultSettings';
import {
  createChildTask,
  fetchChildTasksForCurrentParent,
  fetchWorkItems,
  getActiveTabId,
  isActiveTabAzureDevOps,
  getActiveWorkItemContext,
  setActiveWorkItemParent
} from './tabMessaging';
import type {
  ActiveWorkItemContext,
  ChildTaskItem,
  ParentSuggestionGroup,
  ParentSuggestionItem,
  ParentSuggestionStore,
  Settings,
  WorkItemResult
} from '@/types';

interface StatusMessage {
  kind: 'info' | 'success' | 'error';
  text: string;
}

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

const MAX_DYNAMIC_SUGGESTIONS = 5;
const MAX_IN_MEMORY_SUGGESTIONS = 40;

export function App() {
  const [activeTab, setActiveTab] = useState<SidepanelTabId>('work-items');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [activeWorkItemContext, setActiveWorkItemContext] =
    useState<ActiveWorkItemContext | null>(null);
  const [parentWorkItemId, setParentWorkItemId] = useState<number | null>(null);
  const [childTasks, setChildTasks] = useState<ChildTaskItem[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [result, setResult] = useState<WorkItemResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const [createTaskStatusMessage, setCreateTaskStatusMessage] =
    useState<StatusMessage | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [hiddenTaskStates, setHiddenTaskStates] = useState<string[]>([]);
  const [parentSuggestions, setParentSuggestions] =
    useState<ParentSuggestionStore>(EMPTY_PARENT_SUGGESTIONS);
  const [pinnedActiveWorkItemContext, setPinnedActiveWorkItemContext] =
    useState<ActiveWorkItemContext | null>(null);
  const [linkExternal, setLinkExternal] = useState(true);

  const isActiveItemPinned = Boolean(pinnedActiveWorkItemContext);

  const availableTaskStates = useMemo(() => {
    const unique = new Set(childTasks.map((task) => task.state));
    return Array.from(unique).sort((left, right) => {
      return getStateSortWeight(left) - getStateSortWeight(right);
    });
  }, [childTasks]);

  const visibleChildTasks = useMemo(() => {
    const hidden = new Set(hiddenTaskStates);
    return childTasks.filter((task) => !hidden.has(task.state));
  }, [childTasks, hiddenTaskStates]);

  const suggestionGroup: ParentSuggestionGroup | null = (() => {
    const workItemType = normalizeWorkItemType(
      activeWorkItemContext?.current.workItemType ?? ''
    );

    if (workItemType === 'task') {
      return 'parentable';
    }

    if (isParentableType(workItemType)) {
      return 'feature';
    }

    return null;
  })();

  const suggestedParents: (ParentSuggestionItem & { isPinned: boolean })[] =
    (() => {
      if (!suggestionGroup) {
        return [];
      }

      const recent = parentSuggestions.recentByGroup[suggestionGroup];
      const pinnedIds = parentSuggestions.pinnedIdsByGroup[suggestionGroup];
      const byId = new Map(recent.map((entry) => [entry.id, entry]));

      const pinned = pinnedIds
        .map((id) => byId.get(id))
        .filter((entry): entry is ParentSuggestionItem => Boolean(entry))
        .map((entry) => ({ ...entry, isPinned: true }));

      const pinnedSet = new Set(pinned.map((entry) => entry.id));
      const dynamic = recent
        .filter((entry) => !pinnedSet.has(entry.id))
        .slice(0, MAX_DYNAMIC_SUGGESTIONS)
        .map((entry) => ({ ...entry, isPinned: false }));

      return [...pinned, ...dynamic];
    })();

  useEffect(() => {
    void (async () => {
      const [
        storedSettings,
        cachedResult,
        storedActiveTab,
        storedHiddenStates,
        storedParentSuggestions,
        storedPinnedContext
      ] = await Promise.all([
        loadSettings(),
        loadCachedWorkItems(),
        loadActiveSidepanelTab(),
        loadHiddenChildTaskStates(),
        loadParentSuggestions(),
        loadPinnedActiveWorkItemContext()
      ]);

      setSettings(storedSettings);
      setActiveTab(storedActiveTab);
      setHiddenTaskStates(storedHiddenStates);
      setParentSuggestions(storedParentSuggestions);
      setPinnedActiveWorkItemContext(storedPinnedContext);
      await refreshActiveTabLinkMode();

      if (cachedResult) {
        setResult(cachedResult);
        setHasFetchedOnce(true);
        setStatusMessage({
          kind: 'info',
          text: 'Showing last fetched work items. Click Fetch work items to refresh.'
        });
      }

      if (storedPinnedContext) {
        setActiveWorkItemContext(storedPinnedContext);
        setParentWorkItemId(storedPinnedContext.parentId);
        if (storedPinnedContext.parentId) {
          await refreshChildTasks(storedPinnedContext.parentId);
        }
        return;
      }

      await refreshActiveWorkItemContext();
    })();
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void refreshActiveTabLinkMode();

      if (isActiveItemPinned) {
        return;
      }

      void refreshActiveWorkItemContext();
    };

    const onVisibilityChange = () => {
      void refreshActiveTabLinkMode();

      if (document.hidden || isActiveItemPinned) {
        return;
      }

      void refreshActiveWorkItemContext();
    };

    const onTabActivated = () => {
      void refreshActiveTabLinkMode();

      if (isActiveItemPinned) {
        return;
      }

      void refreshActiveWorkItemContext();
    };

    const onTabUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab
    ) => {
      void refreshActiveTabLinkMode();

      if (isActiveItemPinned || !tab.active) {
        return;
      }

      if (changeInfo.status === 'complete' || changeInfo.url) {
        void refreshActiveWorkItemContext();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [isActiveItemPinned]);

  async function refreshActiveTabLinkMode() {
    try {
      const isAzureDevOpsTab = await isActiveTabAzureDevOps();
      setLinkExternal(!isAzureDevOpsTab);
    } catch {
      setLinkExternal(true);
    }
  }

  async function onSaveSettings() {
    await saveSettings({
      assignedTo: settings.assignedTo.trim()
    });
    setStatusMessage({ kind: 'success', text: 'Settings saved.' });
  }

  function onReloadExtension() {
    setHasFetchedOnce(false);
    setStatusMessage({
      kind: 'info',
      text: 'Extension reloading. Refresh the active Azure DevOps tab before fetching again.'
    });
    chrome.runtime.reload();
  }

  async function onFetchWorkItems() {
    try {
      setIsLoading(true);
      setLoadingMessage('Fetching work items...');
      setHasFetchedOnce(true);
      setStatusMessage(null);

      const response = await fetchWorkItems(settings);

      if (!response.ok) {
        setStatusMessage({
          kind: 'error',
          text: result
            ? `${response.error} Showing last fetched work items.`
            : response.error
        });
        return;
      }

      setResult(response.result);
      setStatusMessage({
        kind: 'success',
        text: `Fetched ${response.result.count} work item(s).`
      });
      void saveCachedWorkItems(response.result).catch(() => undefined);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setStatusMessage({
        kind: 'error',
        text: result
          ? `${errorMessage} Showing last fetched work items.`
          : errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshActiveWorkItemContext(
    forceResync = false,
    bypassPinnedCheck = false
  ) {
    try {
      if (!bypassPinnedCheck && pinnedActiveWorkItemContext) {
        setActiveWorkItemContext(pinnedActiveWorkItemContext);
        setParentWorkItemId(pinnedActiveWorkItemContext.parentId);

        if (pinnedActiveWorkItemContext.parentId) {
          await refreshChildTasks(pinnedActiveWorkItemContext.parentId);
        } else {
          setChildTasks([]);
        }

        return;
      }

      const response = await getActiveWorkItemContext(forceResync);

      if (!response.ok) {
        if (forceResync && activeWorkItemContext) {
          setCreateTaskStatusMessage({
            kind: 'info',
            text: `Resync did not find a new active item. Keeping ${activeItemHeading}.`
          });
          return;
        }

        setActiveWorkItemContext(null);
        setParentWorkItemId(null);
        setChildTasks([]);
        setCreateTaskStatusMessage({ kind: 'info', text: response.error });
        return;
      }

      setActiveWorkItemContext(response.result);
      setParentWorkItemId(response.result.parentId);

      const suggestion = getSuggestionSource(response.result);
      if (suggestion) {
        setParentSuggestions((current) =>
          upsertSuggestionInMemory(current, suggestion.group, suggestion.item)
        );
        void upsertParentSuggestion(suggestion.group, suggestion.item).catch(
          () => undefined
        );
      }

      if (response.result.parentId) {
        setCreateTaskStatusMessage({
          kind: 'info',
          text: `Ready to create child tasks for #${response.result.parentId}.`
        });
        await refreshChildTasks(response.result.parentId);
      } else {
        setChildTasks([]);
        setCreateTaskStatusMessage({
          kind: 'info',
          text: 'No parent detected. Pick a suggested parent or open a parentable work item.'
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (forceResync && activeWorkItemContext) {
        setCreateTaskStatusMessage({
          kind: 'error',
          text: `Resync failed: ${errorMessage}`
        });
        return;
      }

      setActiveWorkItemContext(null);
      setParentWorkItemId(null);
      setChildTasks([]);
      setCreateTaskStatusMessage({ kind: 'error', text: errorMessage });
    }
  }

  async function refreshChildTasks(preferredParentId?: number) {
    const response = await fetchChildTasksForCurrentParent(preferredParentId);

    if (!response.ok) {
      throw new Error(response.error);
    }

    setChildTasks(response.result);
  }

  async function onCreateTaskFromCurrentWorkItem() {
    const trimmedTitle = taskTitle.trim();

    if (!trimmedTitle) {
      setCreateTaskStatusMessage({
        kind: 'error',
        text: 'Enter a task title before creating.'
      });
      return;
    }

    try {
      setIsCreatingTask(true);
      setCreateTaskStatusMessage(null);

      const response = await createChildTask(
        trimmedTitle,
        parentWorkItemId ?? undefined
      );

      if (!response.ok) {
        setCreateTaskStatusMessage({
          kind: 'error',
          text: response.error
        });
        return;
      }

      setParentWorkItemId(response.result.parentId);
      await refreshChildTasks(response.result.parentId);
      setTaskTitle('');
      setCreateTaskStatusMessage({
        kind: 'success',
        text: `Created task #${response.result.id} under #${response.result.parentId}.`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setCreateTaskStatusMessage({
        kind: 'error',
        text: errorMessage
      });
    } finally {
      setIsCreatingTask(false);
    }
  }

  function onSelectTab(tabId: SidepanelTabId) {
    setActiveTab(tabId);

    if (tabId === 'settings') {
      return;
    }

    void saveActiveSidepanelTab(tabId).catch(() => undefined);
  }

  function onToggleTaskStateFilter(state: string, isChecked: boolean) {
    setHiddenTaskStates((current) => {
      const nextSet = new Set(current);

      if (isChecked) {
        nextSet.delete(state);
      } else {
        nextSet.add(state);
      }

      const next = Array.from(nextSet);
      void saveHiddenChildTaskStates(next).catch(() => undefined);
      return next;
    });
  }

  async function onSetSuggestedParent(parentId: number) {
    try {
      setCreateTaskStatusMessage({
        kind: 'info',
        text: `Setting #${parentId} as parent for the active work item...`
      });

      const response = await setActiveWorkItemParent(parentId);
      if (!response.ok) {
        setCreateTaskStatusMessage({ kind: 'error', text: response.error });
        return;
      }

      await refreshActiveWorkItemContext();
      setCreateTaskStatusMessage({
        kind: 'success',
        text: `Parent updated to #${parentId} for the active work item.`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setCreateTaskStatusMessage({ kind: 'error', text: errorMessage });
    }
  }

  function onTogglePinSuggestedParent(parentId: number, isPinned: boolean) {
    if (!suggestionGroup) {
      return;
    }

    setParentSuggestions((current) => {
      const existing = current.pinnedIdsByGroup[suggestionGroup];
      const nextPinned = isPinned
        ? [parentId, ...existing.filter((entry) => entry !== parentId)]
        : existing.filter((entry) => entry !== parentId);

      return {
        ...current,
        pinnedIdsByGroup: {
          ...current.pinnedIdsByGroup,
          [suggestionGroup]: nextPinned
        }
      };
    });

    void setParentSuggestionPinned(suggestionGroup, parentId, isPinned).catch(
      () => undefined
    );
  }

  async function onTogglePinActiveItem() {
    if (isActiveItemPinned) {
      setPinnedActiveWorkItemContext(null);
      await clearPinnedActiveWorkItemContext();
      setCreateTaskStatusMessage({
        kind: 'info',
        text: 'Active work item unpinned. Detection is enabled again.'
      });
      await refreshActiveWorkItemContext(false, true);
      return;
    }

    if (!activeWorkItemContext) {
      setCreateTaskStatusMessage({
        kind: 'error',
        text: 'Open or detect a work item before pinning.'
      });
      return;
    }

    setPinnedActiveWorkItemContext(activeWorkItemContext);
    await savePinnedActiveWorkItemContext(activeWorkItemContext);
    setCreateTaskStatusMessage({
      kind: 'success',
      text: `Pinned #${activeWorkItemContext.current.id}. Detection is now bypassed.`
    });
  }

  async function onActiveItemBannerClick() {
    if (isActiveItemPinned && pinnedActiveWorkItemContext) {
      const tabId = await getActiveTabId();
      await chrome.tabs.update(tabId, {
        url: pinnedActiveWorkItemContext.current.url
      });
      return;
    }

    await onForceResyncActiveItem();
  }

  async function onForceResyncActiveItem() {
    setCreateTaskStatusMessage({
      kind: 'info',
      text: 'Resyncing active work item from page state...'
    });
    await refreshActiveWorkItemContext(true);
  }

  const activeItemHeading = activeWorkItemContext
    ? `#${activeWorkItemContext.current.id} [${activeWorkItemContext.current.workItemType || 'Unknown'}] ${activeWorkItemContext.current.title || '(untitled)'}`
    : 'No active Azure DevOps work item detected';

  return (
    <div className="wrap">
      <button
        type="button"
        className="active-work-item-banner"
        title={
          isActiveItemPinned
            ? 'Pinned: click to open this work item'
            : 'Click to resync from the active Azure DevOps page state'
        }
        onClick={() => {
          void onActiveItemBannerClick();
        }}
      >
        <span className="active-work-item-label">
          {isActiveItemPinned
            ? 'Active item (pinned: click to open)'
            : 'Active item (click to resync)'}
        </span>
        <span className="active-work-item-title">{activeItemHeading}</span>
      </button>

      <Tabs
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        isActiveItemPinned={isActiveItemPinned}
        onTogglePinActiveItem={() => {
          void onTogglePinActiveItem();
        }}
        activeItemTabLabel={activeItemHeading}
      />

      {activeTab === 'settings' ? (
        <SettingsCard
          settings={settings}
          onChange={setSettings}
          onSave={onSaveSettings}
          onReloadExtension={onReloadExtension}
          isLoading={isLoading}
        />
      ) : null}

      {activeTab === 'work-items' ? (
        <StatusCard
          loadingMessage={loadingMessage}
          isLoading={isLoading}
          result={result}
          statusMessage={statusMessage}
          preFetchHint={
            hasFetchedOnce
              ? null
              : 'Panel reloaded. Click Fetch work items to load the latest data.'
          }
          onFetchWorkItems={onFetchWorkItems}
          isActionDisabled={isLoading || isCreatingTask}
          linkExternal={linkExternal}
        />
      ) : null}

      {activeTab === 'work-item' ? (
        <WorkItemCard
          taskTitle={taskTitle}
          onTaskTitleChange={setTaskTitle}
          onCreateTask={onCreateTaskFromCurrentWorkItem}
          parentWorkItemId={parentWorkItemId}
          isParentDetected={Boolean(parentWorkItemId)}
          createdTasks={visibleChildTasks}
          availableTaskStates={availableTaskStates}
          hiddenTaskStates={hiddenTaskStates}
          onToggleTaskStateFilter={onToggleTaskStateFilter}
          isActionDisabled={isLoading || isCreatingTask}
          statusMessage={createTaskStatusMessage}
          suggestedParents={suggestedParents}
          suggestionMode={getSuggestionModeLabel(suggestionGroup)}
          onSetSuggestedParent={onSetSuggestedParent}
          onTogglePinSuggestedParent={onTogglePinSuggestedParent}
          linkExternal={linkExternal}
        />
      ) : null}
    </div>
  );
}

function normalizeWorkItemType(value: string): string {
  return value.trim().toLowerCase();
}

function isParentableType(workItemType: string): boolean {
  return (
    workItemType === 'bug' ||
    workItemType === 'pbi' ||
    workItemType === 'product backlog item' ||
    workItemType === 'improvement'
  );
}

function getSuggestionSource(context: ActiveWorkItemContext): {
  group: ParentSuggestionGroup;
  item: Omit<ParentSuggestionItem, 'lastVisitedAt'>;
} | null {
  const normalizedType = normalizeWorkItemType(context.current.workItemType);

  if (isParentableType(normalizedType)) {
    return {
      group: 'parentable',
      item: {
        id: context.current.id,
        title: context.current.title,
        workItemType: context.current.workItemType,
        url: context.current.url
      }
    };
  }

  if (normalizedType === 'feature') {
    return {
      group: 'feature',
      item: {
        id: context.current.id,
        title: context.current.title,
        workItemType: context.current.workItemType,
        url: context.current.url
      }
    };
  }

  return null;
}

function upsertSuggestionInMemory(
  current: ParentSuggestionStore,
  group: ParentSuggestionGroup,
  item: Omit<ParentSuggestionItem, 'lastVisitedAt'>
): ParentSuggestionStore {
  const now = Date.now();
  const pinnedIds = new Set(current.pinnedIdsByGroup[group]);
  const sorted = [
    { ...item, lastVisitedAt: now },
    ...current.recentByGroup[group].filter((entry) => entry.id !== item.id)
  ];

  const pinned = sorted.filter((entry) => pinnedIds.has(entry.id));
  const dynamic = sorted
    .filter((entry) => !pinnedIds.has(entry.id))
    .slice(0, MAX_IN_MEMORY_SUGGESTIONS);

  return {
    ...current,
    recentByGroup: {
      ...current.recentByGroup,
      [group]: [...pinned, ...dynamic]
    }
  };
}

function getSuggestionModeLabel(
  group: ParentSuggestionGroup | null
): 'parentable' | 'feature' | null {
  if (!group) {
    return null;
  }

  return group;
}

function getStateSortWeight(state: string): number {
  const normalized = state.trim().toLowerCase();
  return normalized === 'to do' || normalized === 'todo' || normalized === 'new'
    ? 0
    : 1;
}
