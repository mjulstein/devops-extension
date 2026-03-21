import clsx from 'clsx';
import type { ClosedDateRange, WorkItemResult } from '@/types';
import classes from './StatusCard.module.css';
import { ClosedDateRangeControls } from './atoms/ClosedDateRangeControls';
import { WorkItemsToolbar } from './atoms/WorkItemsToolbar';
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
      <WorkItemsToolbar
        showWorkItemParentDetails={showWorkItemParentDetails}
        isActionDisabled={isActionDisabled}
        onFetchWorkItems={onFetchWorkItems}
        onToggleShowWorkItemParentDetails={onToggleShowWorkItemParentDetails}
      />

      {isLoading ? (
        <div className={classes.loading}>{loadingMessage}</div>
      ) : null}

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

          <ClosedDateRangeControls
            closedDateRange={closedDateRange}
            isClosedEndTodayShortcut={isClosedEndTodayShortcut}
            isActionDisabled={isActionDisabled}
            onClosedDateRangeChange={onClosedDateRangeChange}
            onEnableCustomClosedEndDate={onEnableCustomClosedEndDate}
            onResetClosedDateRange={onResetClosedDateRange}
          />

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
