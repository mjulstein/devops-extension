import { useEffect, useState } from "react";
import { SettingsCard } from "./components/SettingsCard";
import { StatusCard, parseResultFromResponse, stringifyResponse } from "./components/StatusCard";
import { loadSettings, saveSettings } from "./functions/chromeStorage";
import { defaultSettings } from "./functions/defaultSettings";
import { fetchWorkItems, pingPage, testAzdoApi } from "./functions/tabMessaging";
import type { Settings, WorkItemResult } from "./functions/types";

export function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [debugText, setDebugText] = useState("Waiting...");
  const [result, setResult] = useState<WorkItemResult | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await loadSettings();
      setSettings(stored);
    })();
  }, []);

  async function onSaveSettings() {
    await saveSettings({
      assignedTo: settings.assignedTo.trim()
    });
    setDebugText("Settings saved.");
  }

  async function onShowStoredSettings() {
    const stored = await loadSettings();
    setDebugText(JSON.stringify(stored, null, 2));
  }

  async function runAction(action: () => Promise<unknown>, message: string, updateResult: boolean) {
    try {
      setIsLoading(true);
      setLoadingMessage(message);

      const response = await action();
      setDebugText(stringifyResponse(response));

      if (updateResult) {
        const parsed = parseResultFromResponse(response);
        setResult(parsed);
      }
    } catch (error) {
      setResult(null);
      setDebugText(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function onPingPage() {
    await runAction(() => pingPage(), "Pinging current page...", false);
  }

  async function onTestApi() {
    await runAction(() => testAzdoApi(), "Testing Azure DevOps API...", false);
  }

  async function onFetchWorkItems() {
    await runAction(() => fetchWorkItems(settings), "Fetching work items...", true);
  }

  return (
    <div className="wrap">
      <h1>DevOps Daily Export</h1>

      <SettingsCard
        settings={settings}
        onChange={setSettings}
        onSave={onSaveSettings}
        isLoading={isLoading}
      />

      <StatusCard
        loadingMessage={loadingMessage}
        isLoading={isLoading}
        debugText={debugText}
        result={result}
        onShowStoredSettings={onShowStoredSettings}
        onPingPage={onPingPage}
        onTestApi={onTestApi}
        onFetchWorkItems={onFetchWorkItems}
        isActionDisabled={isLoading}
      />
    </div>
  );
}
