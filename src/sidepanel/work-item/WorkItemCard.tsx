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
  availableTaskStates: string[];
  hiddenTaskStates: string[];
  onToggleTaskStateFilter: (state: string, isChecked: boolean) => void;
  isActionDisabled: boolean;
  statusMessage: {
    kind: 'info' | 'success' | 'error';
    text: string;
  } | null;
  suggestedParents: ParentSuggestionView[];
  suggestionMode: 'parentable' | 'feature' | null;
  onSetSuggestedParent: (parentId: number) => Promise<void>;
  onTogglePinSuggestedParent: (parentId: number, isPinned: boolean) => void;
  linkExternal: boolean;
}

export function WorkItemCard({
  taskTitle,
  onTaskTitleChange,
  onCreateTask,
  parentWorkItemId,
  isParentDetected,
  createdTasks,
  availableTaskStates,
  hiddenTaskStates,
  onToggleTaskStateFilter,
  isActionDisabled,
  statusMessage,
  suggestedParents,
  suggestionMode,
  onSetSuggestedParent,
  onTogglePinSuggestedParent,
  linkExternal
}: WorkItemCardProps) {
  const buttonLabel = parentWorkItemId
    ? `create task for #${parentWorkItemId}`
    : 'create task for #workitemId';

  return (
    <section className="card">
      <form
        className="work-item-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreateTask();
        }}
      >
        <label>
          Task title
          <input
            type="text"
            value={taskTitle}
            onChange={(event) => onTaskTitleChange(event.target.value)}
            placeholder="Type task name and press Enter"
            disabled={isActionDisabled}
          />
        </label>
        <button type="submit" disabled={isActionDisabled}>
          {buttonLabel}
        </button>
      </form>

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
        <div className="parent-suggestion-title">
          {suggestionMode === 'feature'
            ? 'Recent features'
            : suggestionMode === 'parentable'
              ? 'Recent bugs / improvements / PBIs'
              : 'Recent parent suggestions'}
        </div>

        {suggestedParents.length ? (
          suggestedParents.map((item) => {
            const isSelected = parentWorkItemId === item.id;
            return (
              <div key={item.id} className="parent-suggestion-row">
                <Link
                  href={item.url}
                  external={linkExternal}
                  className={`parent-suggestion-link ${isSelected ? 'selected' : ''}`}
                  title={item.title}
                >
                  #{item.id} [{item.workItemType}] - {item.title}
                </Link>
                <button
                  type="button"
                  className="parent-suggestion-action"
                  onClick={() => {
                    void onSetSuggestedParent(item.id);
                  }}
                >
                  set as parent
                </button>
                <button
                  type="button"
                  className="parent-suggestion-action parent-suggestion-pin"
                  onClick={() =>
                    onTogglePinSuggestedParent(item.id, !item.isPinned)
                  }
                >
                  {item.isPinned ? 'unpin' : 'pin'}
                </button>
              </div>
            );
          })
        ) : (
          <div className="created-task-empty">
            {suggestionMode
              ? 'No recent suggestions yet. Visit a matching parentable work item to populate this list.'
              : 'Suggestions appear here when the active item is a Task, Bug, PBI, Improvement, or Feature.'}
          </div>
        )}
      </div>

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
          createdTasks.map((task) => (
            <Link
              key={task.id}
              href={task.url}
              external={linkExternal}
              className="created-task-link"
            >
              #{task.id} [{task.state}] - {task.title}
            </Link>
          ))
        ) : (
          <div className="created-task-empty">
            No child tasks found for the current parent work item.
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
