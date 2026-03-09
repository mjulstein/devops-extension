import { WorkItemSection } from "./WorkItemSection";
import type { RuntimeResponse, WorkItemResult } from "../functions/types";

type StatusCardProps = {
  loadingMessage: string;
  isLoading: boolean;
  debugText: string;
  result: WorkItemResult | null;
  onShowStoredSettings: () => Promise<void>;
  onPingPage: () => Promise<void>;
  onTestApi: () => Promise<void>;
  onFetchWorkItems: () => Promise<void>;
  isActionDisabled: boolean;
};

export function StatusCard({
  loadingMessage,
  isLoading,
  debugText,
  result,
  onShowStoredSettings,
  onPingPage,
  onTestApi,
  onFetchWorkItems,
  isActionDisabled
}: StatusCardProps) {
  return (
    <section className="card">
      <h2>Status</h2>
      <div className="button-row">
        <button onClick={() => void onShowStoredSettings()} disabled={isActionDisabled}>
          Test button
        </button>
        <button onClick={() => void onPingPage()} disabled={isActionDisabled}>
          Ping current page
        </button>
        <button onClick={() => void onTestApi()} disabled={isActionDisabled}>
          Test Azure DevOps API
        </button>
        <button onClick={() => void onFetchWorkItems()} disabled={isActionDisabled}>
          Fetch work items
        </button>
      </div>

      <div className={`loading ${isLoading ? "" : "hidden"}`}>{loadingMessage}</div>

      <details>
        <summary>Raw response</summary>
        <pre>{debugText}</pre>
      </details>

      <div>
        {result ? (
          <>
            <WorkItemSection title="TODO" emptyText="No open items." items={result.openItems} />
            <WorkItemSection title="Closed last week" emptyText="No recently closed items." items={result.closedItems} />
          </>
        ) : null}
      </div>
    </section>
  );
}

export function stringifyResponse(response: unknown): string {
  return JSON.stringify(response, null, 2);
}

export function parseResultFromResponse(
  response: RuntimeResponse<WorkItemResult> | unknown
): WorkItemResult | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const typed = response as RuntimeResponse<WorkItemResult>;
  if (!typed.ok) {
    return null;
  }

  return typed.result;
}
