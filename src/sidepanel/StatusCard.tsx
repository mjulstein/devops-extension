import { WorkItemSection } from "./WorkItemSection";
import type { WorkItemResult } from "./types";

type StatusCardProps = {
  loadingMessage: string;
  isLoading: boolean;
  result: WorkItemResult | null;
  statusMessage: {
    kind: "info" | "success" | "error";
    text: string;
  } | null;
  preFetchHint: string | null;
  onFetchWorkItems: () => Promise<void>;
  isActionDisabled: boolean;
};

export function StatusCard({
  loadingMessage,
  isLoading,
  result,
  statusMessage,
  preFetchHint,
  onFetchWorkItems,
  isActionDisabled
}: StatusCardProps) {
  return (
    <section className="card">
      <h2>Work items</h2>
      <div className="button-row">
        <button onClick={() => void onFetchWorkItems()} disabled={isActionDisabled}>
          Fetch work items
        </button>
      </div>

      <div className={`loading ${isLoading ? "" : "hidden"}`}>{loadingMessage}</div>

      {preFetchHint ? <div className="status-message status-warning">{preFetchHint}</div> : null}

      {statusMessage ? (
        <div className={`status-message status-${statusMessage.kind}`}>{statusMessage.text}</div>
      ) : null}

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
