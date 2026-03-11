import type { ChildTaskItem } from './types';

type CreateTaskCardProps = {
  taskTitle: string;
  onTaskTitleChange: (value: string) => void;
  onCreateTask: () => Promise<void>;
  parentWorkItemId: number | null;
  createdTasks: ChildTaskItem[];
  isActionDisabled: boolean;
  statusMessage: {
    kind: 'info' | 'success' | 'error';
    text: string;
  } | null;
};

export function CreateTaskCard({
  taskTitle,
  onTaskTitleChange,
  onCreateTask,
  parentWorkItemId,
  createdTasks,
  isActionDisabled,
  statusMessage
}: CreateTaskCardProps) {
  const buttonLabel = parentWorkItemId
    ? `create task for #${parentWorkItemId}`
    : 'create task for #workitemId';

  return (
    <section className="card">
      <form
        className="create-task-form"
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
          Open a Bug, PBI, Improvement, or a child Task page, then press Enter to create task children for its parent.
        </div>
      )}

      {parentWorkItemId ? (
        <div className="current-parent">Current parent: #{parentWorkItemId}</div>
      ) : (
        <div className="current-parent">Current parent: not detected</div>
      )}

      <div className="created-task-list">
        {createdTasks.length ? (
          createdTasks.map((task) => (
            <a
              key={task.id}
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="created-task-link"
            >
              #{task.id} [{task.state}] - {task.title}
            </a>
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
