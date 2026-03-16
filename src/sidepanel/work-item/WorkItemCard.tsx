import { useRef, type FormEvent } from 'react';
import type { ChildTaskItem, ParentSuggestionItem } from '@/types';
import { Link } from '../Link';

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
  recentFeatureSuggestions,
  recentParentableSuggestions,
  onSetFeatureParent,
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

  return (
    <section className="card">
      {statusMessage ? (
        <div className={`status-message status-${statusMessage.kind}`}>
          {statusMessage.text}
        </div>
      ) : (
        <div className="status-message status-info">
          Open a Bug, PBI, Improvement, or a child Task page, then press Enter
          to create task children for its parent.
        </div>
      )}

      {parentWorkItemId ? (
        <div className="current-parent">
          Current parent: #{parentWorkItemId}{' '}
          {isParentDetected
            ? '(detected from active work item)'
            : '(selected from suggestions)'}
        </div>
      ) : (
        <div className="current-parent">Current parent: not set</div>
      )}

      <div className="parent-suggestion-list">
        <div className="parent-suggestion-title">Recent features</div>
        {recentFeatureSuggestions.length ? (
          recentFeatureSuggestions.map((item) => (
            <div key={`feature-${item.id}`} className="parent-suggestion-row">
              <Link
                href={item.url}
                external={linkExternal}
                className="parent-suggestion-link"
                title={item.title}
              >
                #{item.id} [{item.workItemType}] - {item.title}
              </Link>
              <button
                type="button"
                className="parent-suggestion-action"
                onClick={() => {
                  void onSetFeatureParent(item.id);
                }}
              >
                set feature
              </button>
              <button
                type="button"
                className="parent-suggestion-action parent-suggestion-pin"
                onClick={() =>
                  onTogglePinSuggestedParent('feature', item.id, !item.isPinned)
                }
              >
                {item.isPinned ? 'unpin' : 'pin'}
              </button>
            </div>
          ))
        ) : (
          <div className="created-task-empty">
            No recent features yet. Visit a feature work item to populate this
            list.
          </div>
        )}
      </div>

      <form
        className="work-item-form"
        onSubmit={(event) => {
          void onSubmitCreateTask(event);
        }}
      >
        <label>
          Task title
          <div className="work-item-input-row">
            <input
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
              className="work-item-submit-small"
              title="Create task"
            >
              +
            </button>
          </div>
        </label>
        <div className="current-parent work-item-parent-hint">
          Enter creates a task under #{parentWorkItemId ?? 'workitemId'}.
        </div>
      </form>

      <div className="state-filter-row">
        {availableTaskStates.map((state) => {
          const isChecked = !hiddenTaskStates.includes(state);
          return (
            <label key={state} className="state-filter-item" title={state}>
              <input
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

      <div className="created-task-list">
        {createdTasks.length ? (
          createdTasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            return (
              <button
                key={task.id}
                type="button"
                className={`created-task-select ${isSelected ? 'selected' : ''}`}
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
          <div className="created-task-empty">
            No child tasks found for the current parent work item.
          </div>
        )}
      </div>

      <div className="parent-suggestion-list">
        <div className="parent-suggestion-title">
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
                className="parent-suggestion-row"
              >
                <Link
                  href={item.url}
                  external={linkExternal}
                  className={`parent-suggestion-link ${isCurrentParent ? 'selected' : ''}`}
                  title={item.title}
                >
                  #{item.id} [{item.workItemType}] - {item.title}
                </Link>
                <button
                  type="button"
                  className="parent-suggestion-action"
                  disabled={!selectedTaskId}
                  onClick={() => {
                    void onReparentSelectedTask(item.id);
                  }}
                >
                  set as parent
                </button>
                <button
                  type="button"
                  className="parent-suggestion-action parent-suggestion-pin"
                  onClick={() =>
                    onTogglePinSuggestedParent(
                      'parentable',
                      item.id,
                      !item.isPinned
                    )
                  }
                >
                  {item.isPinned ? 'unpin' : 'pin'}
                </button>
              </div>
            );
          })
        ) : (
          <div className="created-task-empty">
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
