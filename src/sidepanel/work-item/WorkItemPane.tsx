import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { ChildTaskItem, ParentSuggestionItem } from '@/types';
import classes from './WorkItemCard.module.css';
import { ParentSuggestionRow } from './atoms/ParentSuggestionRow';
import { TaskList } from './atoms/TaskList';
import { TaskStateFilters } from './atoms/TaskStateFilters';
import { TaskTitleForm } from './atoms/TaskTitleForm';
import { RecentFeaturesCard } from './RecentFeaturesCard';

interface ParentSuggestionView extends ParentSuggestionItem {
  isPinned: boolean;
}

interface WorkItemCardProps {
  taskTitle: string;
  onTaskTitleChange: (value: string) => void;
  onCreateTask: () => Promise<void>;
  parentWorkItemId: number | null;
  isParentDetected: boolean;
  createdTasks: ChildTaskItem[];
  selectedTaskId: number | null;
  onSelectTask: (task: ChildTaskItem) => Promise<void>;
  availableTaskStates: string[];
  hiddenTaskStates: string[];
  onToggleTaskStateFilter: (state: string, isChecked: boolean) => void;
  isActionDisabled: boolean;
  statusMessage: {
    kind: 'info' | 'success' | 'error';
    text: string;
  } | null;
  recentFeatureSuggestions: ParentSuggestionView[];
  recentParentableSuggestions: ParentSuggestionView[];
  onSetFeatureParent: (featureId: number) => Promise<void>;
  onReparentSelectedTask: (parentId: number) => Promise<void>;
  onTogglePinSuggestedParent: (
    group: 'parentable' | 'feature',
    parentId: number,
    isPinned: boolean
  ) => void;
  isRecentFeaturesCollapsed: boolean;
  onToggleRecentFeaturesCollapsed: () => Promise<void>;
  linkExternal: boolean;
}

export function WorkItemPane({
  taskTitle,
  onTaskTitleChange,
  onCreateTask,
  parentWorkItemId,
  isParentDetected,
  createdTasks,
  selectedTaskId,
  onSelectTask,
  availableTaskStates,
  hiddenTaskStates,
  onToggleTaskStateFilter,
  isActionDisabled,
  statusMessage,
  recentFeatureSuggestions,
  recentParentableSuggestions,
  onSetFeatureParent,
  onReparentSelectedTask,
  onTogglePinSuggestedParent,
  isRecentFeaturesCollapsed,
  onToggleRecentFeaturesCollapsed,
  linkExternal
}: WorkItemCardProps) {
  const statusKindClassNames = {
    info: classes.statusInfo,
    success: classes.statusSuccess,
    error: classes.statusError
  } as const;

  return (
    <>
      <RecentFeaturesCard
        items={recentFeatureSuggestions}
        isCollapsed={isRecentFeaturesCollapsed}
        onToggleCollapsed={() => {
          void onToggleRecentFeaturesCollapsed();
        }}
        onSetFeatureParent={onSetFeatureParent}
        onTogglePinSuggestedParent={onTogglePinSuggestedParent}
        linkExternal={linkExternal}
      />

      <section className={clsx(classes.card, classes.taskCard)}>
        <div className={classes.cardHeader}>
          <div className={classes.title}>Task children</div>
        </div>
        <StatusNotice
          toneClassName={
            statusMessage ? statusKindClassNames[statusMessage.kind] : null
          }
        >
          {statusMessage ? (
            statusMessage.text
          ) : (
            <>
              Open a Bug, PBI, Improvement, or a child Task page, then press
              Enter to create task children for its parent.
            </>
          )}
        </StatusNotice>

        <TaskTitleForm
          taskTitle={taskTitle}
          parentWorkItemId={parentWorkItemId}
          isParentDetected={isParentDetected}
          isActionDisabled={isActionDisabled}
          onTaskTitleChange={onTaskTitleChange}
          onCreateTask={onCreateTask}
        />

        <TaskStateFilters
          availableTaskStates={availableTaskStates}
          hiddenTaskStates={hiddenTaskStates}
          onToggleTaskStateFilter={onToggleTaskStateFilter}
        />

        <TaskList
          tasks={createdTasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
        />

        <div className={classes.parentSuggestionList}>
          <div className={classes.parentSuggestionTitle}>
            {selectedTaskId
              ? `Reparent selected task #${selectedTaskId}`
              : 'Select a task to reparent'}
          </div>

          {recentParentableSuggestions.length ? (
            recentParentableSuggestions.map((item) => {
              return (
                <ParentSuggestionRow
                  key={`parentable-${item.id}`}
                  id={item.id}
                  title={item.title}
                  url={item.url}
                  workItemType={item.workItemType}
                  isPinned={item.isPinned}
                  actionLabel="set as parent"
                  onAction={() => {
                    void onReparentSelectedTask(item.id);
                  }}
                  onTogglePin={() => {
                    onTogglePinSuggestedParent(
                      'parentable',
                      item.id,
                      !item.isPinned
                    );
                  }}
                  linkExternal={linkExternal}
                  isActionDisabled={!selectedTaskId}
                  isCurrentParent={parentWorkItemId === item.id}
                  pinLabel={`Pin suggestion #${item.id}`}
                  unpinLabel={`Unpin suggestion #${item.id}`}
                />
              );
            })
          ) : (
            <div className={classes.createdTaskEmpty}>
              No recent bugs / improvements / PBIs yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

interface StatusNoticeProps {
  children: ReactNode;
  toneClassName?: string | null;
}

function StatusNotice({ children, toneClassName }: StatusNoticeProps) {
  return (
    <div
      className={clsx(
        classes.statusMessage,
        toneClassName ?? classes.statusInfo
      )}
    >
      {children}
    </div>
  );
}
