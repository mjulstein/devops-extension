import { useEffect, useMemo, useState } from 'react';
import { SettingsCard } from './SettingsCard';
import { StatusCard } from './StatusCard';
import { CreateTaskCard } from './CreateTaskCard';
import {
  loadActiveSidepanelTab,
  loadCachedWorkItems,
  loadHiddenChildTaskStates,
  loadSettings,
  saveActiveSidepanelTab,
  saveCachedWorkItems,
  saveHiddenChildTaskStates,
  saveSettings
} from './chromeStorage';
import { defaultSettings } from './defaultSettings';
import {
  createChildTask,
  fetchChildTasksForCurrentParent,
  fetchWorkItems,
  getActiveWorkItemContext
} from './tabMessaging';
import type { ChildTaskItem, Settings, SidepanelTabId, WorkItemResult } from './types';

const TAB_ORDER: Array<{ id: SidepanelTabId; label: string }> = [
  { id: 'settings', label: 'Settings' },
  { id: 'work-items', label: 'Work items' },
  { id: 'create-task', label: 'Create child tasks' }
];

type StatusMessage = {
  kind: 'info' | 'success' | 'error';
  text: string;
};

export function App() {
  const [activeTab, setActiveTab] = useState<SidepanelTabId>('work-items');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
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

  useEffect(() => {
    void (async () => {
      const [storedSettings, cachedResult, storedActiveTab, storedHiddenStates] =
        await Promise.all([
          loadSettings(),
          loadCachedWorkItems(),
          loadActiveSidepanelTab(),
          loadHiddenChildTaskStates()
        ]);

      setSettings(storedSettings);
      setActiveTab(storedActiveTab);
      setHiddenTaskStates(storedHiddenStates);

      if (cachedResult) {
        setResult(cachedResult);
        setHasFetchedOnce(true);
        setStatusMessage({
          kind: 'info',
          text: 'Showing last fetched work items. Click Fetch work items to refresh.'
        });
      }

      await refreshActiveWorkItemContext();
    })();
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void refreshActiveWorkItemContext();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refreshActiveWorkItemContext();
      }
    };

    const onTabActivated = () => {
      void refreshActiveWorkItemContext();
    };

    const onTabUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (!tab.active) {
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
  }, []);

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

  async function refreshActiveWorkItemContext() {
    try {
      const response = await getActiveWorkItemContext();

      if (!response.ok) {
        setParentWorkItemId(null);
        setChildTasks([]);
        setCreateTaskStatusMessage({ kind: 'info', text: response.error });
        return;
      }

      setParentWorkItemId(response.result.parentId);
      setCreateTaskStatusMessage({
        kind: 'info',
        text: `Ready to create child tasks for #${response.result.parentId}.`
      });
      await refreshChildTasks();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setParentWorkItemId(null);
      setChildTasks([]);
      setCreateTaskStatusMessage({ kind: 'error', text: errorMessage });
    }
  }

  async function refreshChildTasks() {
    const response = await fetchChildTasksForCurrentParent();

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

      const response = await createChildTask(trimmedTitle);

      if (!response.ok) {
        setCreateTaskStatusMessage({
          kind: 'error',
          text: response.error
        });
        return;
      }

      setParentWorkItemId(response.result.parentId);
      await refreshChildTasks();
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

  return (
    <div className="wrap">
      <nav className="tab-row" aria-label="Side panel sections">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-handle ${activeTab === tab.id ? 'active' : ''}`}
            aria-pressed={activeTab === tab.id}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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
        />
      ) : null}

      {activeTab === 'create-task' ? (
        <CreateTaskCard
          taskTitle={taskTitle}
          onTaskTitleChange={setTaskTitle}
          onCreateTask={onCreateTaskFromCurrentWorkItem}
          parentWorkItemId={parentWorkItemId}
          createdTasks={visibleChildTasks}
          availableTaskStates={availableTaskStates}
          hiddenTaskStates={hiddenTaskStates}
          onToggleTaskStateFilter={onToggleTaskStateFilter}
          isActionDisabled={isLoading || isCreatingTask}
          statusMessage={createTaskStatusMessage}
        />
      ) : null}
    </div>
  );
}

function getStateSortWeight(state: string): number {
  const normalized = state.trim().toLowerCase();
  return normalized === 'to do' || normalized === 'todo' || normalized === 'new'
    ? 0
    : 1;
}
