import { useEffect, useState } from 'react';
import { SettingsCard } from './SettingsCard';
import { StatusCard } from './StatusCard';
import { CreateTaskCard } from './CreateTaskCard';
import {
  loadActiveSidepanelTab,
  loadCachedWorkItems,
  loadSettings,
  saveActiveSidepanelTab,
  saveCachedWorkItems,
  saveSettings
} from './chromeStorage';
import { defaultSettings } from './defaultSettings';
import {
  createChildTask,
  fetchWorkItems,
  getActiveWorkItemContext
} from './tabMessaging';
import type {
  CreatedChildTask,
  Settings,
  SidepanelTabId,
  WorkItemResult
} from './types';

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
  const [createdTasks, setCreatedTasks] = useState<CreatedChildTask[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [result, setResult] = useState<WorkItemResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const [createTaskStatusMessage, setCreateTaskStatusMessage] =
    useState<StatusMessage | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  const visibleCreatedTasks = parentWorkItemId
    ? createdTasks.filter((task) => task.parentId === parentWorkItemId)
    : [];

  useEffect(() => {
    void (async () => {
      const [storedSettings, cachedResult, storedActiveTab] = await Promise.all([
        loadSettings(),
        loadCachedWorkItems(),
        loadActiveSidepanelTab()
      ]);

      setSettings(storedSettings);
      setActiveTab(storedActiveTab);

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
      changeInfo: chrome.tabs.TabChangeInfo,
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
        setCreateTaskStatusMessage({ kind: 'info', text: response.error });
        return;
      }

      setParentWorkItemId(response.result.parentId);
      setCreateTaskStatusMessage({
        kind: 'info',
        text: `Ready to create child tasks for #${response.result.parentId}.`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setParentWorkItemId(null);
      setCreateTaskStatusMessage({ kind: 'error', text: errorMessage });
    }
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
      setCreatedTasks((current) => [response.result, ...current]);
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
          createdTasks={visibleCreatedTasks}
          isActionDisabled={isLoading || isCreatingTask}
          statusMessage={createTaskStatusMessage}
        />
      ) : null}
    </div>
  );
}
