import clsx from 'clsx';
import type { ChildTaskItem } from '@/types';
import classes from './TaskButton.module.css';
import { getTaskStateTone, type TaskStateTone } from './taskStateDisplay';

interface TaskButtonProps {
  task: ChildTaskItem;
  isSelected: boolean;
  onSelectTask: (task: ChildTaskItem) => Promise<void>;
}

const toneClassNames: Record<TaskStateTone, string> = {
  todo: classes.todo,
  'in-progress': classes.inProgress,
  done: classes.done,
  blocked: classes.blocked,
  unknown: classes.unknown
};

export function TaskButton({
  task,
  isSelected,
  onSelectTask
}: TaskButtonProps) {
  const tone = getTaskStateTone(task.state);

  return (
    <button
      type="button"
      className={clsx(
        classes.button,
        toneClassNames[tone],
        isSelected && classes.selected
      )}
      data-state-tone={tone}
      onClick={() => {
        void onSelectTask(task);
      }}
      title={`#${task.id} [${task.state}] - ${task.title}`}
      aria-label={`Task #${task.id}, ${task.state}: ${task.title}`}
    >
      #{task.id} - {task.title}
    </button>
  );
}
