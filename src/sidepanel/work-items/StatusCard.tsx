import clsx from 'clsx';
import type { ClosedDateRange, WorkItemResult } from '@/types';
import classes from './StatusCard.module.css';
import { WorkItemSection } from './WorkItemSection';

interface StatusCardProps {
  loadingMessage: string;
  isLoading: boolean;
  result: WorkItemResult | null;
  closedDateRange: ClosedDateRange;
  isClosedEndTodayShortcut: boolean;
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
  onEnableCustomClosedEndDate: () => void;
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
  isClosedEndTodayShortcut,
  showWorkItemParentDetails,
  statusMessage,
  preFetchHint,
  onFetchWorkItems,
  onClosedDateRangeChange,
  onEnableCustomClosedEndDate,
  onResetClosedDateRange,
  onRefetchClosedDay,
  onToggleShowWorkItemParentDetails,
  isActionDisabled,
  linkExternal
}: StatusCardProps) {
  const statusKindClassNames = {
    info: classes.statusInfo,
    success: classes.statusSuccess,
    error: classes.statusError
  } as const;

  return (
    <section className={classes.card}>
      <div className={classes.buttonRow}>
        <button
          className={classes.button}
          onClick={() => void onFetchWorkItems()}
          disabled={isActionDisabled}
        >
          Fetch work items
        </button>

        <label
          className={clsx(
            classes.checkboxToggle,
            classes.workItemsParentToggle
          )}
        >
          <input
            className={classes.checkboxInput}
            type="checkbox"
            checked={showWorkItemParentDetails}
            onChange={() => {
              void onToggleShowWorkItemParentDetails();
            }}
          />
          Show task parent details
        </label>
      </div>

      <div className={clsx(classes.loading, !isLoading && classes.hidden)}>
        {loadingMessage}
      </div>

      {preFetchHint ? (
        <div className={clsx(classes.statusMessage, classes.statusWarning)}>
          {preFetchHint}
        </div>
      ) : null}

      {statusMessage ? (
        <div
          className={clsx(
            classes.statusMessage,
            statusKindClassNames[statusMessage.kind]
          )}
        >
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

          <div
            className={clsx(
              classes.workItemsControls,
              classes.workItemsControlsCompact
            )}
          >
            <div className={classes.workItemsDateRange}>
              <button
                type="button"
                className={clsx(classes.button, classes.workItemsResetButton)}
                onClick={() => {
                  void onResetClosedDateRange();
                }}
                disabled={isActionDisabled}
              >
                Reset
              </button>

              <div className={classes.workItemsDateField}>
                <input
                  className={classes.dateInput}
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

              <span
                className={classes.workItemsDateSeparator}
                aria-hidden="true"
              >
                -
              </span>

              <div className={classes.workItemsDateField}>
                {isClosedEndTodayShortcut ? (
                  <button
                    type="button"
                    className={clsx(
                      classes.button,
                      classes.workItemsTodayButton
                    )}
                    title="Using today. Click to choose a custom date."
                    disabled={isActionDisabled}
                    onClick={onEnableCustomClosedEndDate}
                  >
                    today
                  </button>
                ) : (
                  <input
                    className={classes.dateInput}
                    type="date"
                    value={closedDateRange.end}
                    aria-label="Closed through"
                    title="Closed through"
                    disabled={isActionDisabled}
                    onChange={(event) =>
                      void onClosedDateRangeChange('end', event.target.value)
                    }
                  />
                )}
              </div>
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
