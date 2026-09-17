import clsx from 'clsx';
import type {
  ClosedDateRange,
  PullRequestActivityItem,
  WorkItem,
  WorkItemResult
} from '@/types';
import classes from './StatusCard.module.css';
import { Button } from '@/sidepanel/atoms/Button';
import { ClosedDateRangeControls } from './atoms/ClosedDateRangeControls';
import { WorkItemsToolbar } from './atoms/WorkItemsToolbar';
import {
  WorkItemListTabs,
  type WorkItemListTab
} from './atoms/WorkItemListTabs';
import { PullRequestList } from './atoms/PullRequestList';
import { QuickTaskList } from './atoms/QuickTaskList';
import { WorkItemSection } from './WorkItemSection';
import {
  omitParentsWithStartedTasks,
  splitByActivity
} from './atoms/workItemGrouping';

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
  onDismissStatusMessage: () => void;
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
  onDismissCreatedQuickTask,
  onDismissStatusMessage
}: StatusCardProps) {
  // Grouped, a parent is the heading its tasks sit under, so it earns its place.
  // Flat, a parent whose task is already in progress is just a duplicate row.
  const todoItems =
    result && !showWorkItemParentDetails
      ? omitParentsWithStartedTasks(result.openItems)
      : (result?.openItems ?? []);

  // Authored is mostly items filed for other people, so the same parent rule
  // applies and the dormant remainder moves behind an accordion.
  const authoredSplit = splitByActivity(
    showWorkItemParentDetails
      ? (authoredItems ?? [])
      : omitParentsWithStartedTasks(authoredItems ?? [])
  );

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
          onToggleShowWorkItemParentDetails={onToggleShowWorkItemParentDetails}
        />

        {!!preFetchHint && (
          <div className={clsx(classes.statusMessage, classes.statusWarning)}>
            {preFetchHint}
          </div>
        )}
      </section>
      <section className={classes.card}>
        <WorkItemListTabs
          activeTab={activeListTab}
          todoCount={result === null ? null : todoItems.length}
          authoredCount={authoredItems === null ? null : authoredItems.length}
          pullRequestCount={pullRequests?.length ?? null}
          quickTaskCount={quickTasks?.length ?? null}
          onSelectTab={onSelectListTab}
        />

        {isLoading && <div className={classes.loading}>{loadingMessage}</div>}

        {!!statusMessage && (
          <div
            className={clsx(
              classes.statusMessage,
              classes.dismissible,
              statusKindClassNames[statusMessage.kind]
            )}
          >
            <span>{statusMessage.text}</span>
            <Button
              variant="quiet"
              size="compact"
              icon="×"
              description="Dismiss this message"
              className={classes.dismiss}
              onClick={onDismissStatusMessage}
            />
          </div>
        )}

        {!!createdQuickTask && (
          <div className={classes.createdNotice}>
            <Button
              variant="quiet"
              size="compact"
              className={classes.createdLink}
              description="Open the new task in a new tab"
              onClick={() => {
                void onOpenCreatedQuickTask();
              }}
            >
              Created #{createdQuickTask.id}
            </Button>
            <Button
              variant="quiet"
              size="compact"
              icon="×"
              description="Dismiss the created-task notice"
              onClick={onDismissCreatedQuickTask}
            />
          </div>
        )}

        {activeListTab === 'todo' ? (
          result === null ? (
            <p>Click TODO to load your work items.</p>
          ) : (
            <div className={clsx(isLoading && classes.refreshing)}>
              <WorkItemSection
                title="TODO"
                showTitle={false}
                emptyText="No open items."
                items={todoItems}
                showState={true}
                groupByParent={showWorkItemParentDetails}
                linkExternal={linkExternal}
              />
            </div>
          )
        ) : activeListTab === 'quick' ? (
          <>
            {!!quickTasksError && (
              <div className={clsx(classes.statusMessage, classes.statusError)}>
                {quickTasksError}
              </div>
            )}
            {quickTasks === null && isQuickTasksLoading ? (
              <div className={classes.loading}>Loading quick tasks…</div>
            ) : (
              <div className={clsx(isQuickTasksLoading && classes.refreshing)}>
                <QuickTaskList
                  items={quickTasks ?? []}
                  pinnedIds={pinnedQuickTaskIds}
                  parentId={quickTaskParentId}
                  title={quickTaskTitle}
                  isActionDisabled={isActionDisabled}
                  linkExternal={linkExternal}
                  onTitleChange={onQuickTaskTitleChange}
                  onCreate={onCreateQuickTaskFromTitle}
                  onCreateFromPage={onCreateQuickTask}
                  canCreateFromPage={canCreateQuickTask}
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
              <div className={clsx(classes.statusMessage, classes.statusError)}>
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
              <div className={clsx(classes.statusMessage, classes.statusError)}>
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
                  emptyText={
                    authoredSplit.idle.length > 0
                      ? 'Nothing you authored is being worked on yet.'
                      : 'No open items you authored and are not assigned to.'
                  }
                  items={authoredSplit.active}
                  showState={true}
                  groupByParent={showWorkItemParentDetails}
                  linkExternal={linkExternal}
                />
                {authoredSplit.idle.length > 0 && (
                  <details className={classes.idleGroup}>
                    <summary className={classes.idleSummary}>
                      Not started ({authoredSplit.idle.length})
                    </summary>
                    <WorkItemSection
                      title="Not started"
                      showTitle={false}
                      emptyText=""
                      items={authoredSplit.idle}
                      showState={true}
                      groupByParent={showWorkItemParentDetails}
                      linkExternal={linkExternal}
                    />
                  </details>
                )}
              </div>
            )}
          </>
        )}
      </section>

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
