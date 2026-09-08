import clsx from 'clsx';
import type {
  ClosedDateRange,
  PullRequestActivityItem,
  WorkItem,
  WorkItemResult
} from '@/types';
import classes from './StatusCard.module.css';
import { ClosedDateRangeControls } from './atoms/ClosedDateRangeControls';
import { WorkItemsToolbar } from './atoms/WorkItemsToolbar';
import {
  WorkItemListTabs,
  type WorkItemListTab
} from './atoms/WorkItemListTabs';
import { PullRequestList } from './atoms/PullRequestList';
import { QuickTaskList } from './atoms/QuickTaskList';
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
  onCreateQuickTask: () => Promise<void>;
  canCreateQuickTask: boolean;
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
  pullRequests: PullRequestActivityItem[] | null;
  isPullRequestsLoading: boolean;
  pullRequestsError: string | null;
  quickTasks: WorkItem[] | null;
  isQuickTasksLoading: boolean;
  quickTasksError: string | null;
  pinnedQuickTaskIds: number[];
  quickTaskParentId: number | null;
  quickTaskTitle: string;
  onQuickTaskTitleChange: (value: string) => void;
  onCreateQuickTaskFromTitle: () => Promise<void>;
  onTogglePinQuickTask: (id: number) => Promise<void>;
  quickTaskArchiveId: number | null;
  onArchiveQuickTask: (id: number) => Promise<void>;
  createdQuickTask: { id: number; url: string } | null;
  onOpenCreatedQuickTask: () => Promise<void>;
  onDismissCreatedQuickTask: () => void;
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
  onCreateQuickTask,
  canCreateQuickTask,
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
  closedRollupError,
  pullRequests,
  isPullRequestsLoading,
  pullRequestsError,
  quickTasks,
  isQuickTasksLoading,
  quickTasksError,
  pinnedQuickTaskIds,
  quickTaskParentId,
  quickTaskTitle,
  onQuickTaskTitleChange,
  onCreateQuickTaskFromTitle,
  onTogglePinQuickTask,
  quickTaskArchiveId,
  onArchiveQuickTask,
  createdQuickTask,
  onOpenCreatedQuickTask,
  onDismissCreatedQuickTask
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
          canCreateQuickTask={canCreateQuickTask}
          onFetchWorkItems={onFetchWorkItems}
          onCreateQuickTask={onCreateQuickTask}
          onToggleShowWorkItemParentDetails={onToggleShowWorkItemParentDetails}
        />

        {!!createdQuickTask && (
          <div className={classes.createdNotice}>
            <button
              type="button"
              className={classes.createdLink}
              title="Open the new task in a new tab"
              onClick={() => {
                void onOpenCreatedQuickTask();
              }}
            >
              Created #{createdQuickTask.id}
            </button>
            <button
              type="button"
              className={classes.createdDismiss}
              title="Dismiss"
              aria-label="Dismiss the created-task notice"
              onClick={onDismissCreatedQuickTask}
            >
              ×
            </button>
          </div>
        )}

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
            pullRequestCount={pullRequests?.length ?? null}
            quickTaskCount={quickTasks?.length ?? null}
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
          ) : activeListTab === 'quick' ? (
            <>
              {!!quickTasksError && (
                <div
                  className={clsx(classes.statusMessage, classes.statusError)}
                >
                  {quickTasksError}
                </div>
              )}
              {quickTasks === null && isQuickTasksLoading ? (
                <div className={classes.loading}>Loading quick tasks…</div>
              ) : (
                <div
                  className={clsx(isQuickTasksLoading && classes.refreshing)}
                >
                  <QuickTaskList
                    items={quickTasks ?? []}
                    pinnedIds={pinnedQuickTaskIds}
                    parentId={quickTaskParentId}
                    title={quickTaskTitle}
                    isActionDisabled={isActionDisabled}
                    linkExternal={linkExternal}
                    onTitleChange={onQuickTaskTitleChange}
                    onCreate={onCreateQuickTaskFromTitle}
                    onTogglePin={onTogglePinQuickTask}
                    archiveId={quickTaskArchiveId}
                    onArchive={onArchiveQuickTask}
                  />
                </div>
              )}
            </>
          ) : activeListTab === 'prs' ? (
            <>
              {!!pullRequestsError && (
                <div
                  className={clsx(classes.statusMessage, classes.statusError)}
                >
                  {pullRequestsError}
                </div>
              )}
              {pullRequests === null && isPullRequestsLoading ? (
                <div className={classes.loading}>
                  Scanning pull-request comments…
                </div>
              ) : (
                <div
                  className={clsx(isPullRequestsLoading && classes.refreshing)}
                >
                  <PullRequestList
                    items={pullRequests ?? []}
                    emptyText="No pull requests you authored, commented on recently, or were mentioned in."
                    linkExternal={linkExternal}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {!!authoredError && (
                <div
                  className={clsx(classes.statusMessage, classes.statusError)}
                >
                  {authoredError}
                </div>
              )}
              {authoredItems === null && isAuthoredLoading ? (
                <div className={classes.loading}>Loading authored items…</div>
              ) : (
                <div className={clsx(isAuthoredLoading && classes.refreshing)}>
                  <WorkItemSection
                    title="Authored"
                    showTitle={false}
                    emptyText="No open items you authored and are not assigned to."
                    items={authoredItems ?? []}
                    showState={true}
                    groupByParent={showWorkItemParentDetails}
                    linkExternal={linkExternal}
                  />
                </div>
              )}
            </>
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
            <>
              {!!closedRollupError && (
                <div
                  className={clsx(classes.statusMessage, classes.statusError)}
                >
                  {closedRollupError}
                </div>
              )}
              {closedParentRollup === null && isClosedRollupLoading ? (
                <div className={classes.loading}>Loading finished items…</div>
              ) : (
                <div
                  className={clsx(isClosedRollupLoading && classes.refreshing)}
                >
                  <WorkItemSection
                    title="Closed"
                    emptyText="Nothing finished in this range — every item still has open work."
                    items={closedParentRollup ?? []}
                    showState={false}
                    groupByClosedDate={true}
                    onRefetchClosedDay={onRefetchClosedDay}
                    linkExternal={linkExternal}
                  />
                </div>
              )}
            </>
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
