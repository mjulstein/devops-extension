import { useEffect, useState } from "react";
import { SettingsCard } from "./SettingsCard";
import { StatusCard } from "./StatusCard";
import { loadSettings, saveSettings } from "./chromeStorage";
import { defaultSettings } from "./defaultSettings";
import { fetchWorkItems } from "./tabMessaging";
import type { Settings, WorkItemResult } from "./types";

type StatusMessage = {
  kind: "info" | "success" | "error";
  text: string;
};

export function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [result, setResult] = useState<WorkItemResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

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
    setStatusMessage({ kind: "success", text: "Settings saved." });
  }

  function onReloadExtension() {
    setHasFetchedOnce(false);
    setStatusMessage({
      kind: "info",
      text: "Extension reloading. Refresh the active Azure DevOps tab before fetching again."
    });
    chrome.runtime.reload();
  }

  async function onFetchWorkItems() {
    try {
      setIsLoading(true);
      setLoadingMessage("Fetching work items...");
      setHasFetchedOnce(true);
      setStatusMessage(null);

      const response = await fetchWorkItems(settings);

      if (!response.ok) {
        setResult(null);
        setStatusMessage({ kind: "error", text: response.error });
        return;
      }

      setResult(response.result);
      setStatusMessage({ kind: "success", text: `Fetched ${response.result.count} work item(s).` });
    } catch (error) {
      setResult(null);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage({ kind: "error", text: errorMessage });
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
            : "Panel reloaded. Click Fetch work items to load the latest data."
        }
        onFetchWorkItems={onFetchWorkItems}
        isActionDisabled={isLoading}
      />
    </div>
  );
}
