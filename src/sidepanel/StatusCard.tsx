import type { WorkItemResult } from '@/types';
import { WorkItemSection } from './WorkItemSection';

interface StatusCardProps {
  loadingMessage: string;
  isLoading: boolean;
  result: WorkItemResult | null;
  statusMessage: {
    kind: 'info' | 'success' | 'error';
    text: string;
  } | null;
  preFetchHint: string | null;
  onFetchWorkItems: () => Promise<void>;
  isActionDisabled: boolean;
  linkExternal: boolean;
}

export function StatusCard({
  loadingMessage,
  isLoading,
  result,
  statusMessage,
  preFetchHint,
  onFetchWorkItems,
  isActionDisabled,
  linkExternal
}: StatusCardProps) {
  return (
    <section className="card">
      <div className="button-row">
        <button
          onClick={() => void onFetchWorkItems()}
          disabled={isActionDisabled}
        >
          Fetch work items
        </button>
      </div>

      <div className={`loading ${isLoading ? '' : 'hidden'}`}>
        {loadingMessage}
      </div>

      {preFetchHint ? (
        <div className="status-message status-warning">{preFetchHint}</div>
      ) : null}

      {statusMessage ? (
        <div className={`status-message status-${statusMessage.kind}`}>
          {statusMessage.text}
        </div>
      ) : null}

      <div>
        {result ? (
          <>
            <WorkItemSection
              title="TODO"
              emptyText="No open items."
              items={result.openItems}
              showClosedAt={false}
              showState={true}
              linkExternal={linkExternal}
            />
            <WorkItemSection
              title="Closed last week"
              emptyText="No recently closed items."
              items={result.closedItems}
              showClosedAt={true}
              showState={false}
              linkExternal={linkExternal}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
