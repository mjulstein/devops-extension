import clsx from 'clsx';
import type { ClosedDateRange, WorkItem, WorkItemResult } from '@/types';
import classes from './StatusCard.module.css';
import { ClosedDateRangeControls } from './atoms/ClosedDateRangeControls';
import { WorkItemsToolbar } from './atoms/WorkItemsToolbar';
import {
  WorkItemListTabs,
  type WorkItemListTab
} from './atoms/WorkItemListTabs';
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
  activeListTab: WorkItemListTab;
  onSelectListTab: (tab: WorkItemListTab) => void;
  authoredItems: WorkItem[] | null;
  isAuthoredLoading: boolean;
  authoredError: string | null;
  closedParentRollup: WorkItem[] | null;
  isClosedRollupLoading: boolean;
  closedRollupError: string | null;
}

export function WorkItemsPane({
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
  linkExternal,
  activeListTab,
  onSelectListTab,
  authoredItems,
  isAuthoredLoading,
  authoredError,
  closedParentRollup,
  isClosedRollupLoading,
  closedRollupError
}: StatusCardProps) {
  const statusKindClassNames = {
    info: classes.statusInfo,
    success: classes.statusSuccess,
    error: classes.statusError
  } as const;

  return (
    <>
      <section className={classes.card}>
        <WorkItemsToolbar
          showWorkItemParentDetails={showWorkItemParentDetails}
          isActionDisabled={isActionDisabled}
          onFetchWorkItems={onFetchWorkItems}
          onToggleShowWorkItemParentDetails={onToggleShowWorkItemParentDetails}
        />

        {isLoading && <div className={classes.loading}>{loadingMessage}</div>}

        {!!preFetchHint && (
          <div className={clsx(classes.statusMessage, classes.statusWarning)}>
            {preFetchHint}
          </div>
        )}

        {!!statusMessage && (
          <div
            className={clsx(
              classes.statusMessage,
              statusKindClassNames[statusMessage.kind]
            )}
          >
            {statusMessage.text}
          </div>
        )}
      </section>
      {result && (
        <section className={classes.card}>
          <WorkItemListTabs
            activeTab={activeListTab}
            todoCount={result.openItems.length}
            authoredCount={authoredItems?.length ?? null}
            onSelectTab={onSelectListTab}
          />

          {activeListTab === 'todo' ? (
            <WorkItemSection
              title="TODO"
              showTitle={false}
              emptyText="No open items."
              items={result.openItems}
              showState={true}
              groupByParent={showWorkItemParentDetails}
              linkExternal={linkExternal}
            />
          ) : isAuthoredLoading ? (
            <div className={classes.loading}>Loading authored items…</div>
          ) : authoredError ? (
            <div className={clsx(classes.statusMessage, classes.statusError)}>
              {authoredError}
            </div>
          ) : (
            <WorkItemSection
              title="Authored"
              showTitle={false}
              emptyText="No open items you authored and are not assigned to."
              items={authoredItems ?? []}
              showState={true}
              groupByParent={showWorkItemParentDetails}
              linkExternal={linkExternal}
            />
          )}
        </section>
      )}

      {result && (
        <section className={classes.card}>
          <ClosedDateRangeControls
            closedDateRange={closedDateRange}
            isClosedEndTodayShortcut={isClosedEndTodayShortcut}
            isActionDisabled={isActionDisabled}
            onClosedDateRangeChange={onClosedDateRangeChange}
            onEnableCustomClosedEndDate={onEnableCustomClosedEndDate}
            onResetClosedDateRange={onResetClosedDateRange}
          />
          {showWorkItemParentDetails ? (
            isClosedRollupLoading ? (
              <div className={classes.loading}>Loading finished items…</div>
            ) : closedRollupError ? (
              <div className={clsx(classes.statusMessage, classes.statusError)}>
                {closedRollupError}
              </div>
            ) : (
              <WorkItemSection
                title="Closed"
                emptyText="Nothing finished in this range — every parent still has open tasks."
                items={closedParentRollup ?? []}
                showState={false}
                groupByClosedDate={true}
                onRefetchClosedDay={onRefetchClosedDay}
                linkExternal={linkExternal}
              />
            )
          ) : (
            <WorkItemSection
              title="Closed"
              emptyText="No closed items in this range."
              items={result.closedItems}
              showState={false}
              showParentDetails={showWorkItemParentDetails}
              groupByClosedDate={true}
              onRefetchClosedDay={onRefetchClosedDay}
              linkExternal={linkExternal}
            />
          )}
        </section>
      )}
    </>
  );
}
