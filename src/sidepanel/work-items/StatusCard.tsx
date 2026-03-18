import type { ClosedDateRange, WorkItemResult } from '@/types';
import { WorkItemSection } from './WorkItemSection';

interface StatusCardProps {
  loadingMessage: string;
  isLoading: boolean;
  result: WorkItemResult | null;
  closedDateRange: ClosedDateRange;
  showWorkItemParentDetails: boolean;
  statusMessage: {
    kind: 'info' | 'success' | 'error';
    text: string;
  } | null;
  preFetchHint: string | null;
  onFetchWorkItems: () => Promise<void>;
  onClosedDateRangeChange: (
    key: keyof ClosedDateRange,
    value: string
  ) => Promise<void>;
  onResetClosedDateRange: () => Promise<void>;
  onRefetchClosedDay: (date: string) => Promise<void>;
  onToggleShowWorkItemParentDetails: () => Promise<void>;
  isActionDisabled: boolean;
  linkExternal: boolean;
}

export function StatusCard({
  loadingMessage,
  isLoading,
  result,
  closedDateRange,
  showWorkItemParentDetails,
  statusMessage,
  preFetchHint,
  onFetchWorkItems,
  onClosedDateRangeChange,
  onResetClosedDateRange,
  onRefetchClosedDay,
  onToggleShowWorkItemParentDetails,
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

        <label className="checkbox-toggle work-items-parent-toggle">
          <input
            type="checkbox"
            checked={showWorkItemParentDetails}
            onChange={() => {
              void onToggleShowWorkItemParentDetails();
            }}
          />
          Show task parent details
        </label>
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

      {result ? (
        <div>
          <WorkItemSection
            title="TODO"
            emptyText="No open items."
            items={result.openItems}
            showState={true}
            showParentDetails={showWorkItemParentDetails}
            linkExternal={linkExternal}
          />

          <h3>Closed</h3>

          <div className="work-items-controls work-items-controls-compact">
            <div className="work-items-date-range">
              <div className="work-items-date-field">
                <input
                  type="date"
                  value={closedDateRange.start}
                  aria-label="Closed from"
                  title="Closed from"
                  disabled={isActionDisabled}
                  onChange={(event) =>
                    void onClosedDateRangeChange('start', event.target.value)
                  }
                />
              </div>

              <div className="work-items-date-field">
                <input
                  type="date"
                  value={closedDateRange.end}
                  aria-label="Closed to"
                  title="Closed to"
                  disabled={isActionDisabled}
                  onChange={(event) =>
                    void onClosedDateRangeChange('end', event.target.value)
                  }
                />
              </div>

              <button
                type="button"
                className="work-items-reset-button"
                onClick={() => {
                  void onResetClosedDateRange();
                }}
                disabled={isActionDisabled}
              >
                Reset
              </button>
            </div>
          </div>

          <WorkItemSection
            title="Closed"
            showTitle={false}
            emptyText="No closed items in this range."
            items={result.closedItems}
            showState={false}
            showParentDetails={showWorkItemParentDetails}
            groupByClosedDate={true}
            onRefetchClosedDay={onRefetchClosedDay}
            linkExternal={linkExternal}
          />
        </div>
      ) : null}
    </section>
  );
}
