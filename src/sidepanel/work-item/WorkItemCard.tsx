import clsx from 'clsx';
import { useRef, type FormEvent } from 'react';
import type { ChildTaskItem, ParentSuggestionItem } from '@/types';
import { Link } from '../Link';
import { PinIcon } from './PinIcon';
import classes from './WorkItemCard.module.css';

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
  recentParentableSuggestions: ParentSuggestionView[];
  onReparentSelectedTask: (parentId: number) => Promise<void>;
  onTogglePinSuggestedParent: (
    group: 'parentable' | 'feature',
    parentId: number,
    isPinned: boolean
  ) => void;
  linkExternal: boolean;
}

export function WorkItemCard({
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
  recentParentableSuggestions,
  onReparentSelectedTask,
  onTogglePinSuggestedParent,
  linkExternal
}: WorkItemCardProps) {
  const taskInputRef = useRef<HTMLInputElement | null>(null);

  async function onSubmitCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateTask();
    globalThis.setTimeout(() => {
      taskInputRef.current?.focus();
    }, 0);
  }

  const statusKindClassNames = {
    info: classes.statusInfo,
    success: classes.statusSuccess,
    error: classes.statusError
  } as const;

  return (
    <section className={clsx(classes.card, classes.taskCard)}>
      {statusMessage ? (
        <div
          className={clsx(
            classes.statusMessage,
            statusKindClassNames[statusMessage.kind]
          )}
        >
          {statusMessage.text}
        </div>
      ) : (
        <div className={clsx(classes.statusMessage, classes.statusInfo)}>
          Open a Bug, PBI, Improvement, or a child Task page, then press Enter
          to create task children for its parent.
        </div>
      )}

      <form
        className={classes.workItemForm}
        onSubmit={(event) => {
          void onSubmitCreateTask(event);
        }}
      >
        <label className={classes.fieldLabel}>
          Task title
          <div className={classes.workItemInputRow}>
            <input
              className={classes.textInput}
              ref={taskInputRef}
              type="text"
              value={taskTitle}
              onChange={(event) => onTaskTitleChange(event.target.value)}
              placeholder="Type task name and press Enter"
              disabled={isActionDisabled}
            />
            <button
              type="submit"
              disabled={isActionDisabled}
              className={classes.workItemSubmitSmall}
              title="Create task"
            >
              +
            </button>
          </div>
        </label>
        <div
          className={clsx(classes.currentParent, classes.workItemParentHint)}
        >
          Enter creates a task under #{parentWorkItemId ?? 'workitemId'}.
          {parentWorkItemId
            ? isParentDetected
              ? ' Using the active work item parent.'
              : ' Using the selected suggestion as the parent.'
            : ''}
        </div>
      </form>

      <div className={classes.stateFilterRow}>
        {availableTaskStates.map((state) => {
          const isChecked = !hiddenTaskStates.includes(state);
          return (
            <label
              key={state}
              className={classes.stateFilterItem}
              title={state}
            >
              <input
                className={classes.checkboxInput}
                type="checkbox"
                checked={isChecked}
                onChange={(event) =>
                  onToggleTaskStateFilter(state, event.target.checked)
                }
              />
              <span>{abbreviateState(state)}</span>
            </label>
          );
        })}
      </div>

      <div className={classes.createdTaskList}>
        {createdTasks.length ? (
          createdTasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            return (
              <button
                key={task.id}
                type="button"
                className={clsx(
                  classes.createdTaskSelect,
                  isSelected && classes.createdTaskSelectSelected
                )}
                onClick={() => {
                  void onSelectTask(task);
                }}
                title={task.title}
              >
                #{task.id} [{task.state}] - {task.title}
              </button>
            );
          })
        ) : (
          <div className={classes.createdTaskEmpty}>
            No child tasks found for the current parent work item.
          </div>
        )}
      </div>

      <div className={classes.parentSuggestionList}>
        <div className={classes.parentSuggestionTitle}>
          {selectedTaskId
            ? `Reparent selected task #${selectedTaskId}`
            : 'Select a task to reparent'}
        </div>

        {recentParentableSuggestions.length ? (
          recentParentableSuggestions.map((item) => {
            const isCurrentParent = parentWorkItemId === item.id;
            return (
              <div
                key={`parentable-${item.id}`}
                className={classes.parentSuggestionRow}
              >
                <Link
                  href={item.url}
                  external={linkExternal}
                  className={clsx(
                    classes.parentSuggestionLink,
                    isCurrentParent && classes.parentSuggestionLinkSelected
                  )}
                  title={item.title}
                >
                  #{item.id} [{item.workItemType}] - {item.title}
                </Link>
                <button
                  type="button"
                  className={classes.parentSuggestionAction}
                  disabled={!selectedTaskId}
                  onClick={() => {
                    void onReparentSelectedTask(item.id);
                  }}
                >
                  set as parent
                </button>
                <button
                  type="button"
                  className={clsx(
                    classes.parentSuggestionAction,
                    classes.parentSuggestionPin,
                    classes.pinButton,
                    item.isPinned
                      ? classes.pinButtonPinned
                      : classes.pinButtonUnpinned
                  )}
                  aria-label={
                    item.isPinned
                      ? `Unpin suggestion #${item.id}`
                      : `Pin suggestion #${item.id}`
                  }
                  title={
                    item.isPinned
                      ? `Unpin suggestion #${item.id}`
                      : `Pin suggestion #${item.id}`
                  }
                  onClick={() =>
                    onTogglePinSuggestedParent(
                      'parentable',
                      item.id,
                      !item.isPinned
                    )
                  }
                >
                  <PinIcon
                    isPinned={item.isPinned}
                    className={classes.pinIcon}
                  />
                </button>
              </div>
            );
          })
        ) : (
          <div className={classes.createdTaskEmpty}>
            No recent bugs / improvements / PBIs yet.
          </div>
        )}
      </div>
    </section>
  );
}

function abbreviateState(state: string): string {
  const parts = state.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}
