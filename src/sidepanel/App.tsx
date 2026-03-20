import { useEffect, useMemo, useRef, useState } from 'react';
import { DebugConsolePane, type DebugLogEntry } from './DebugConsolePane';
import { SettingsCard } from './settings';
import { RecentFeaturesCard, WorkItemCard } from './work-item';
import { StatusCard } from './work-items';
import { Tabs, type SidepanelTabId } from './Tabs';
import classes from './App.module.css';
import {
  clearPinnedActiveWorkItemContext,
  loadActiveSidepanelTab,
  loadCachedWorkItems,
  loadHiddenChildTaskStates,
  loadLastVisitedDevOpsContext,
  loadParentSuggestions,
  loadPinnedActiveWorkItemContext,
  loadRecentFeaturesCollapsed,
  loadShowWorkItemParentDetails,
  loadSettings,
  loadWorkItemsClosedDateRange,
  saveActiveSidepanelTab,
  saveCachedWorkItems,
  saveHiddenChildTaskStates,
  saveLastVisitedDevOpsContext,
  savePinnedActiveWorkItemContext,
  saveRecentFeaturesCollapsed,
  saveShowWorkItemParentDetails,
  saveSettings,
  saveWorkItemsClosedDateRange,
  setParentSuggestionPinned,
  upsertParentSuggestion
} from './chromeStorage';
import { tryCreateLastVisitedDevOpsContext } from '../devops/lastVisitedContext';
import { defaultSettings } from './defaultSettings';
import {
  areClosedDateRangesEqual,
  createDefaultClosedDateRange,
  isTodayDateInputValue,
  isValidClosedDateRange
} from './workItemsDateRange';
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
  ClosedDateRange,
  ParentSuggestionGroup,
  ParentSuggestionItem,
  ParentSuggestionStore,
  Settings,
  WorkItem,
  WorkItemsFetchScope,
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
const MAX_DEBUG_LOG_ENTRIES = 120;

export function App() {
  const [activeTab, setActiveTab] = useState<SidepanelTabId>('work-items');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [activeWorkItemContext, setActiveWorkItemContext] =
    useState<ActiveWorkItemContext | null>(null);
  const [parentWorkItemId, setParentWorkItemId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
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
  const [closedDateRange, setClosedDateRange] = useState<ClosedDateRange>(() =>
    createDefaultClosedDateRange()
  );
  const [isClosedEndTodayShortcut, setIsClosedEndTodayShortcut] =
    useState(true);
  const [showWorkItemParentDetails, setShowWorkItemParentDetails] =
    useState(false);
  const [parentSuggestions, setParentSuggestions] =
    useState<ParentSuggestionStore>(EMPTY_PARENT_SUGGESTIONS);
  const [pinnedActiveWorkItemContext, setPinnedActiveWorkItemContext] =
    useState<ActiveWorkItemContext | null>(null);
  const [isRecentFeaturesCollapsed, setIsRecentFeaturesCollapsed] =
    useState(false);
  const [linkExternal, setLinkExternal] = useState(true);
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const workItemsFetchSequenceRef = useRef(0);

  function pushDebugLog(level: DebugLogEntry['level'], message: string): void {
    const entry: DebugLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      message
    };

    setDebugLogs((current) =>
      [entry, ...current].slice(0, MAX_DEBUG_LOG_ENTRIES)
    );
  }

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

  const recentFeatureSuggestions = getSuggestionsByGroup(
    parentSuggestions,
    'feature'
  );

  const recentParentableSuggestions = getSuggestionsByGroup(
    parentSuggestions,
    'parentable'
  );

  useEffect(() => {
    void (async () => {
      const [
        storedSettings,
        lastVisitedDevOpsContext,
        cachedResult,
        storedActiveTab,
        storedHiddenStates,
        storedParentSuggestions,
        storedPinnedContext,
        storedClosedDateRange,
        storedShowWorkItemParentDetails,
        storedRecentFeaturesCollapsed
      ] = await Promise.all([
        loadSettings(),
        loadLastVisitedDevOpsContext(),
        loadCachedWorkItems(),
        loadActiveSidepanelTab(),
        loadHiddenChildTaskStates(),
        loadParentSuggestions(),
        loadPinnedActiveWorkItemContext(),
        loadWorkItemsClosedDateRange(),
        loadShowWorkItemParentDetails(),
        loadRecentFeaturesCollapsed()
      ]);

      const resolvedLastVisitedContext =
        lastVisitedDevOpsContext ?? (await loadActiveTabDevOpsContext());

      pushDebugLog(
        'info',
        resolvedLastVisitedContext
          ? `Resolved org/project context: ${resolvedLastVisitedContext.organization}/${resolvedLastVisitedContext.project}`
          : 'No org/project context resolved yet from storage or active tab.'
      );

      if (!lastVisitedDevOpsContext && resolvedLastVisitedContext) {
        void saveLastVisitedDevOpsContext(resolvedLastVisitedContext).catch(
          () => undefined
        );
      }

      const hydratedSettings = {
        ...storedSettings,
        organization:
          storedSettings.organization.trim() ||
          (resolvedLastVisitedContext?.organization ?? ''),
        project:
          storedSettings.project.trim() ||
          (resolvedLastVisitedContext?.project ?? '')
      };

      setSettings(hydratedSettings);

      if (
        hydratedSettings.organization !== storedSettings.organization ||
        hydratedSettings.project !== storedSettings.project
      ) {
        void saveSettings(hydratedSettings).catch(() => undefined);
      }
      setActiveTab(storedActiveTab);
      setHiddenTaskStates(storedHiddenStates);
      setClosedDateRange(storedClosedDateRange);
      setIsClosedEndTodayShortcut(
        isTodayDateInputValue(storedClosedDateRange.end)
      );
      setShowWorkItemParentDetails(storedShowWorkItemParentDetails);
      setParentSuggestions(storedParentSuggestions);
      setPinnedActiveWorkItemContext(storedPinnedContext);
      setIsRecentFeaturesCollapsed(storedRecentFeaturesCollapsed);
      await refreshActiveTabLinkMode();

      if (cachedResult) {
        pushDebugLog(
          'info',
          `Loaded cached work items (${cachedResult.count}).`
        );
        setResult(cachedResult);
        setHasFetchedOnce(true);
        setStatusMessage({
          kind: 'info',
          text: 'Showing last fetched work items. Click Fetch work items to refresh.'
        });
      }

      if (storedPinnedContext) {
        setActiveWorkItemContext(storedPinnedContext);
        setParentWorkItemId(storedPinnedContext.parent?.id ?? null);
        setSelectedTaskId(storedPinnedContext.viewedTaskId ?? null);
        if (storedPinnedContext.parent?.id) {
          await refreshChildTasks(storedPinnedContext.parent.id);
        }
        return;
      }

      await refreshActiveWorkItemContext();
      pushDebugLog('success', 'Side panel initialization complete.');
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

  async function loadActiveTabDevOpsContext() {
    try {
      const activeTabId = await getActiveTabId();
      const tab = await chrome.tabs.get(activeTabId);
      return tryCreateLastVisitedDevOpsContext(tab.url ?? '');
    } catch {
      return null;
    }
  }

  async function onSaveSettings() {
    await saveSettings(getTrimmedSettingsFromState(settings));
    pushDebugLog(
      'success',
      `Saved settings for ${settings.organization.trim() || '(auto org)'}/${settings.project.trim() || '(auto project)'}.`
    );
    setStatusMessage({ kind: 'success', text: 'Settings saved.' });
  }

  function onReloadExtension() {
    pushDebugLog('info', 'Manual extension reload triggered.');
    setHasFetchedOnce(false);
    setStatusMessage({
      kind: 'info',
      text: 'Extension reloading. Re-open the side panel when it is ready.'
    });
    chrome.runtime.reload();
  }

  async function onFetchWorkItems(options?: {
    closedDateRange?: ClosedDateRange;
    source?: string;
    scope?: WorkItemsFetchScope;
    refetchedClosedDay?: string;
  }) {
    const startedAt = Date.now();
    const fetchSequence = ++workItemsFetchSequenceRef.current;
    const effectiveClosedDateRange =
      options?.closedDateRange ?? closedDateRange;
    const fetchSource = options?.source ?? 'manual';
    const scope = options?.scope ?? 'all';
    const refetchedClosedDay = options?.refetchedClosedDay ?? null;

    try {
      pushDebugLog(
        'info',
        `Fetch requested via ${fetchSource} [${scope}] (org=${settings.organization.trim() || '(auto)'}, project=${settings.project.trim() || '(auto)'}, assignedTo=${settings.assignedTo.trim() || '@me'}, closed=${effectiveClosedDateRange.start}..${effectiveClosedDateRange.end}).`
      );
      setIsLoading(true);
      setLoadingMessage(
        scope === 'all'
          ? 'Fetching work items...'
          : refetchedClosedDay
            ? `Refreshing closed items for ${refetchedClosedDay}...`
            : 'Refreshing closed items...'
      );
      setHasFetchedOnce(true);
      setStatusMessage(null);

      const response = await fetchWorkItems({
        settings: getTrimmedSettingsFromState(settings),
        closedDateRange: effectiveClosedDateRange,
        scope
      });

      if (fetchSequence !== workItemsFetchSequenceRef.current) {
        return;
      }

      if (!response.ok) {
        pushDebugLog(
          'error',
          `Fetch failed in ${Date.now() - startedAt}ms: ${response.error}`
        );
        setStatusMessage({
          kind: 'error',
          text: result
            ? `${response.error} Showing last fetched work items.`
            : response.error
        });
        return;
      }

      const nextResult =
        scope === 'all'
          ? response.result
          : mergeClosedItemsIntoResult(
              result,
              response.result.closedItems,
              closedDateRange,
              refetchedClosedDay
            );

      setResult(nextResult);

      if (scope === 'all') {
        setClosedDateRange(response.result.closedDateRange);
        setIsClosedEndTodayShortcut(
          isTodayDateInputValue(response.result.closedDateRange.end)
        );
      }

      pushDebugLog(
        'success',
        scope === 'all'
          ? `Fetch succeeded in ${Date.now() - startedAt}ms with ${nextResult.count} work items.`
          : `Closed-items refresh succeeded in ${Date.now() - startedAt}ms with ${response.result.closedItems.length} closed work items.`
      );
      setStatusMessage({
        kind: 'success',
        text:
          scope === 'all'
            ? `Fetched ${nextResult.count} work item(s).`
            : refetchedClosedDay
              ? `Refetched closed work items for ${formatClosedDayLabel(refetchedClosedDay)}.`
              : `Updated closed work items for ${effectiveClosedDateRange.start} through ${effectiveClosedDateRange.end}.`
      });
      void saveCachedWorkItems(nextResult).catch(() => undefined);
    } catch (error) {
      if (fetchSequence !== workItemsFetchSequenceRef.current) {
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      pushDebugLog(
        'error',
        `Fetch exception in ${Date.now() - startedAt}ms: ${errorMessage}`
      );
      setStatusMessage({
        kind: 'error',
        text: result
          ? `${errorMessage} Showing last fetched work items.`
          : errorMessage
      });
    } finally {
      if (fetchSequence === workItemsFetchSequenceRef.current) {
        setIsLoading(false);
      }
    }
  }

  async function onClosedDateRangeChange(
    key: keyof ClosedDateRange,
    value: string
  ) {
    const nextRange = {
      ...closedDateRange,
      [key]: value
    };

    setClosedDateRange(nextRange);

    if (key === 'end') {
      setIsClosedEndTodayShortcut(isTodayDateInputValue(value));
    }

    if (!isValidClosedDateRange(nextRange)) {
      setStatusMessage({
        kind: 'info',
        text: 'Choose a valid closed date range to refresh closed items.'
      });
      return;
    }

    await saveWorkItemsClosedDateRange(nextRange);
    await onFetchWorkItems({
      closedDateRange: nextRange,
      source: 'closed-date-range change',
      scope: 'closed'
    });
  }

  async function onResetClosedDateRange() {
    const nextRange = createDefaultClosedDateRange();
    setClosedDateRange(nextRange);
    setIsClosedEndTodayShortcut(true);
    setStatusMessage(null);
    await saveWorkItemsClosedDateRange(nextRange);

    await onFetchWorkItems({
      closedDateRange: nextRange,
      source: areClosedDateRangesEqual(nextRange, closedDateRange)
        ? 'closed-date-range reset refetch'
        : 'closed-date-range reset',
      scope: 'closed'
    });
  }

  async function onRefetchClosedDay(date: string) {
    setStatusMessage(null);
    await onFetchWorkItems({
      closedDateRange: { start: date, end: date },
      source: `closed-day refetch ${date}`,
      scope: 'closed',
      refetchedClosedDay: date
    });
  }

  function onEnableCustomClosedEndDate() {
    setIsClosedEndTodayShortcut(false);
  }

  async function onToggleShowWorkItemParentDetails() {
    const nextValue = !showWorkItemParentDetails;
    setShowWorkItemParentDetails(nextValue);
    await saveShowWorkItemParentDetails(nextValue);
  }

  async function refreshActiveWorkItemContext(
    forceResync = false,
    bypassPinnedCheck = false
  ) {
    try {
      if (!bypassPinnedCheck && pinnedActiveWorkItemContext) {
        setActiveWorkItemContext(pinnedActiveWorkItemContext);
        setParentWorkItemId(pinnedActiveWorkItemContext.parent?.id ?? null);
        setSelectedTaskId(pinnedActiveWorkItemContext.viewedTaskId ?? null);

        if (pinnedActiveWorkItemContext.parent?.id) {
          await refreshChildTasks(pinnedActiveWorkItemContext.parent.id);
        } else {
          setSelectedTaskId(null);
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
        setSelectedTaskId(null);
        setChildTasks([]);
        setCreateTaskStatusMessage({ kind: 'info', text: response.error });
        return;
      }

      const normalizedCurrentType = normalizeWorkItemType(
        response.result.current.workItemType
      );

      if (normalizedCurrentType === 'feature') {
        const featureSuggestion = getSuggestionSource(response.result);
        if (featureSuggestion) {
          setParentSuggestions((current) =>
            upsertSuggestionInMemory(
              current,
              featureSuggestion.group,
              featureSuggestion.item
            )
          );
          void upsertParentSuggestion(
            featureSuggestion.group,
            featureSuggestion.item
          ).catch(() => undefined);
        }

        setCreateTaskStatusMessage({
          kind: 'info',
          text: 'Feature detected. Keeping current parentable work-item context.'
        });
        return;
      }

      setActiveWorkItemContext(response.result);
      setParentWorkItemId(response.result.parent?.id ?? null);

      const suggestion = getSuggestionSource(response.result);
      if (suggestion) {
        setParentSuggestions((current) =>
          upsertSuggestionInMemory(current, suggestion.group, suggestion.item)
        );
        void upsertParentSuggestion(suggestion.group, suggestion.item).catch(
          () => undefined
        );
      }

      if (response.result.parent?.id) {
        if (response.result.viewedTaskId) {
          setSelectedTaskId(response.result.viewedTaskId);
        }
        setCreateTaskStatusMessage({
          kind: 'info',
          text: `Ready to create child tasks for #${response.result.parent.id}.`
        });
        await refreshChildTasks(response.result.parent.id);
      } else {
        setSelectedTaskId(null);
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
      setSelectedTaskId(null);
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
    setSelectedTaskId((current) => {
      if (!response.result.length) {
        return null;
      }

      if (current && response.result.some((item) => item.id === current)) {
        return current;
      }

      return response.result[0]?.id ?? null;
    });
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
      setSelectedTaskId(response.result.id);
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

  function onToggleRecentFeaturesCollapsed() {
    setIsRecentFeaturesCollapsed((current) => {
      const next = !current;
      void saveRecentFeaturesCollapsed(next).catch(() => undefined);
      return next;
    });
  }

  async function onSelectTask(task: ChildTaskItem) {
    setSelectedTaskId(task.id);

    try {
      await chrome.tabs.update({ url: task.url });
      pushDebugLog('info', `Opened task #${task.id} in active tab.`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      pushDebugLog(
        'error',
        `Task button click failed for #${task.id}: ${errorMessage}`
      );
      setCreateTaskStatusMessage({
        kind: 'error',
        text: `Could not open task #${task.id}: ${errorMessage}`
      });
    }
  }

  async function onSetFeatureParent(featureId: number) {
    if (!activeWorkItemContext?.parent?.id) {
      setCreateTaskStatusMessage({
        kind: 'error',
        text: 'No active bug/PBI/improvement selected for feature reparenting.'
      });
      return;
    }

    try {
      setCreateTaskStatusMessage({
        kind: 'info',
        text: `Setting feature #${featureId} as parent for #${activeWorkItemContext.parent.id}...`
      });

      const response = await setActiveWorkItemParent(
        featureId,
        activeWorkItemContext.parent.id
      );
      if (!response.ok) {
        setCreateTaskStatusMessage({ kind: 'error', text: response.error });
        return;
      }

      await refreshActiveWorkItemContext();
      setCreateTaskStatusMessage({
        kind: 'success',
        text: `Feature parent updated to #${featureId} for #${activeWorkItemContext.parent.id}.`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setCreateTaskStatusMessage({ kind: 'error', text: errorMessage });
    }
  }

  async function onReparentSelectedTask(parentId: number) {
    if (!selectedTaskId) {
      setCreateTaskStatusMessage({
        kind: 'error',
        text: 'Select a task first before reparenting.'
      });
      return;
    }

    try {
      setCreateTaskStatusMessage({
        kind: 'info',
        text: `Reparenting task #${selectedTaskId} to #${parentId}...`
      });

      const response = await setActiveWorkItemParent(parentId, selectedTaskId);
      if (!response.ok) {
        setCreateTaskStatusMessage({ kind: 'error', text: response.error });
        return;
      }

      await refreshActiveWorkItemContext();
      setSelectedTaskId(selectedTaskId);
      setCreateTaskStatusMessage({
        kind: 'success',
        text: `Task #${selectedTaskId} reparented to #${parentId}.`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setCreateTaskStatusMessage({ kind: 'error', text: errorMessage });
    }
  }

  function onTogglePinSuggestedParent(
    group: ParentSuggestionGroup,
    parentId: number,
    isPinned: boolean
  ) {
    setParentSuggestions((current) => {
      const existing = current.pinnedIdsByGroup[group];
      const nextPinned = isPinned
        ? [parentId, ...existing.filter((entry) => entry !== parentId)]
        : existing.filter((entry) => entry !== parentId);

      return {
        ...current,
        pinnedIdsByGroup: {
          ...current.pinnedIdsByGroup,
          [group]: nextPinned
        }
      };
    });

    void setParentSuggestionPinned(group, parentId, isPinned).catch(
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

  const activeItemHeading = activeWorkItemContext?.parent
    ? `#${activeWorkItemContext.parent.id} [${activeWorkItemContext.parent.workItemType || 'Unknown'}] ${activeWorkItemContext.parent.title || '(untitled)'}`
    : 'No active Azure DevOps work item detected';

  const activeItemTabLabel =
    activeWorkItemContext?.viewedTaskId && activeWorkItemContext.parent
      ? `${activeItemHeading} (task #${activeWorkItemContext.viewedTaskId})`
      : activeItemHeading;

  return (
    <div className={classes.wrap}>
      <button
        type="button"
        className={classes.activeWorkItemBanner}
        title={
          isActiveItemPinned
            ? 'Pinned: click to open this work item'
            : 'Click to resync from the active Azure DevOps page state'
        }
        onClick={() => {
          void onActiveItemBannerClick();
        }}
      >
        <span className={classes.activeWorkItemLabel}>
          {isActiveItemPinned
            ? 'Active item (pinned: click to open)'
            : 'Active item (click to resync)'}
        </span>
        <span className={classes.activeWorkItemTitle}>{activeItemHeading}</span>
      </button>

      <Tabs
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        isActiveItemPinned={isActiveItemPinned}
        onTogglePinActiveItem={() => {
          void onTogglePinActiveItem();
        }}
        activeItemTabLabel={activeItemTabLabel}
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
          closedDateRange={closedDateRange}
          isClosedEndTodayShortcut={isClosedEndTodayShortcut}
          showWorkItemParentDetails={showWorkItemParentDetails}
          statusMessage={statusMessage}
          preFetchHint={
            hasFetchedOnce
              ? null
              : 'Panel reloaded. Click Fetch work items to load the latest data.'
          }
          onFetchWorkItems={onFetchWorkItems}
          onClosedDateRangeChange={onClosedDateRangeChange}
          onEnableCustomClosedEndDate={onEnableCustomClosedEndDate}
          onResetClosedDateRange={onResetClosedDateRange}
          onRefetchClosedDay={onRefetchClosedDay}
          onToggleShowWorkItemParentDetails={onToggleShowWorkItemParentDetails}
          isActionDisabled={isLoading || isCreatingTask}
          linkExternal={linkExternal}
        />
      ) : null}

      {activeTab === 'work-item' ? (
        <>
          <RecentFeaturesCard
            items={recentFeatureSuggestions}
            isCollapsed={isRecentFeaturesCollapsed}
            onToggleCollapsed={onToggleRecentFeaturesCollapsed}
            onSetFeatureParent={onSetFeatureParent}
            onTogglePinSuggestedParent={onTogglePinSuggestedParent}
            linkExternal={linkExternal}
          />
          <WorkItemCard
            taskTitle={taskTitle}
            onTaskTitleChange={setTaskTitle}
            onCreateTask={onCreateTaskFromCurrentWorkItem}
            parentWorkItemId={parentWorkItemId}
            isParentDetected={Boolean(parentWorkItemId)}
            createdTasks={visibleChildTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            availableTaskStates={availableTaskStates}
            hiddenTaskStates={hiddenTaskStates}
            onToggleTaskStateFilter={onToggleTaskStateFilter}
            isActionDisabled={isLoading || isCreatingTask}
            statusMessage={createTaskStatusMessage}
            recentParentableSuggestions={recentParentableSuggestions}
            onReparentSelectedTask={onReparentSelectedTask}
            onTogglePinSuggestedParent={onTogglePinSuggestedParent}
            linkExternal={linkExternal}
          />
        </>
      ) : null}

      <DebugConsolePane
        entries={debugLogs}
        onClear={() => {
          setDebugLogs([]);
        }}
      />
    </div>
  );
}

function getTrimmedSettingsFromState(settings: Settings): Settings {
  return {
    organization: settings.organization.trim(),
    project: settings.project.trim(),
    assignedTo: settings.assignedTo.trim()
  };
}

function mergeClosedItemsIntoResult(
  current: WorkItemResult | null,
  nextClosedItems: WorkItem[],
  selectedClosedDateRange: ClosedDateRange,
  refetchedClosedDay: string | null
): WorkItemResult {
  const openItems = current?.openItems ?? [];
  const closedItems = refetchedClosedDay
    ? replaceClosedItemsForDay(
        current?.closedItems ?? [],
        refetchedClosedDay,
        nextClosedItems
      )
    : nextClosedItems;

  return {
    count: openItems.length + closedItems.length,
    openItems,
    closedItems,
    closedDateRange: selectedClosedDateRange
  };
}

function replaceClosedItemsForDay(
  currentItems: WorkItem[],
  day: string,
  replacementItems: WorkItem[]
): WorkItem[] {
  const targetDayKey = normalizeClosedDayKey(day);
  const retainedItems = currentItems.filter(
    (item) => normalizeClosedDayKey(item.closedDate) !== targetDayKey
  );

  return [...retainedItems, ...replacementItems].sort(
    compareClosedItemsForView
  );
}

function normalizeClosedDayKey(value: string | null): string {
  if (!value) {
    return 'unknown';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatClosedDayLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function compareClosedItemsForView(left: WorkItem, right: WorkItem): number {
  return (
    getClosedItemTimestamp(right.closedDate) -
      getClosedItemTimestamp(left.closedDate) || right.id - left.id
  );
}

function getClosedItemTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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

  if (normalizedType === 'task' && context.parent) {
    return {
      group: 'parentable',
      item: {
        id: context.parent.id,
        title: context.parent.title,
        workItemType: context.parent.workItemType,
        url: context.parent.url
      }
    };
  }

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

function getSuggestionsByGroup(
  store: ParentSuggestionStore,
  group: ParentSuggestionGroup
): (ParentSuggestionItem & { isPinned: boolean })[] {
  const recent = store.recentByGroup[group];
  const pinnedIds = store.pinnedIdsByGroup[group];
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
function getStateSortWeight(state: string): number {
  const normalized = state.trim().toLowerCase();
  return normalized === 'to do' || normalized === 'todo' || normalized === 'new'
    ? 0
    : 1;
}
