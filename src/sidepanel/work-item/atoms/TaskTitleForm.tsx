import { useRef, type FormEvent } from 'react';
import clsx from 'clsx';
import classes from './TaskTitleForm.module.css';

interface TaskTitleFormProps {
  taskTitle: string;
  parentWorkItemId: number | null;
  isParentDetected: boolean;
  isActionDisabled: boolean;
  onTaskTitleChange: (value: string) => void;
  onCreateTask: () => Promise<void>;
}

export function TaskTitleForm({
  taskTitle,
  parentWorkItemId,
  isParentDetected,
  isActionDisabled,
  onTaskTitleChange,
  onCreateTask
}: TaskTitleFormProps) {
  const taskInputRef = useRef<HTMLInputElement | null>(null);

  async function onSubmitCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateTask();
    globalThis.setTimeout(() => {
      taskInputRef.current?.focus();
    }, 0);
  }

  return (
    <form
      className={classes.form}
      onSubmit={(event) => {
        void onSubmitCreateTask(event);
      }}
    >
      <label className={classes.fieldLabel}>
        Task title
        <div className={classes.inputRow}>
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
            className={classes.submitButton}
            title="Create task"
          >
            +
          </button>
        </div>
      </label>
      <div className={clsx(classes.currentParent, classes.parentHint)}>
        Enter creates a task under #{parentWorkItemId ?? 'workitemId'}.
        {parentWorkItemId
          ? isParentDetected
            ? ' Using the active work item parent.'
            : ' Using the selected suggestion as the parent.'
          : ''}
      </div>
    </form>
  );
}
