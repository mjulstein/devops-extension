import { useEffect, useState } from 'react';
import { SettingsCard } from './SettingsCard';
import { StatusCard } from './StatusCard';
import {
  loadCachedWorkItems,
  loadSettings,
  saveCachedWorkItems,
  saveSettings
} from './chromeStorage';
import { defaultSettings } from './defaultSettings';
import { fetchWorkItems } from './tabMessaging';
import type { Settings, WorkItemResult } from './types';

type StatusMessage = {
  kind: 'info' | 'success' | 'error';
  text: string;
};

export function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [result, setResult] = useState<WorkItemResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  useEffect(() => {
    void (async () => {
      const [storedSettings, cachedResult] = await Promise.all([
        loadSettings(),
        loadCachedWorkItems()
      ]);

      setSettings(storedSettings);

      if (cachedResult) {
        setResult(cachedResult);
        setHasFetchedOnce(true);
        setStatusMessage({
          kind: 'info',
          text: 'Showing last fetched work items. Click Fetch work items to refresh.'
        });
      }
    })();
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

  return (
    <div className="wrap">
      <h1>DevOps Work Items</h1>

      <SettingsCard
        settings={settings}
        onChange={setSettings}
        onSave={onSaveSettings}
        onReloadExtension={onReloadExtension}
        isLoading={isLoading}
      />

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
        isActionDisabled={isLoading}
      />
    </div>
  );
}
