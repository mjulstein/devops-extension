import type { ChildTaskItem } from '@/types';
import classes from './TaskList.module.css';
import { TaskButton } from './TaskButton';

interface TaskListProps {
  tasks: ChildTaskItem[];
  selectedTaskId: number | null;
  onSelectTask: (task: ChildTaskItem) => Promise<void>;
}

export function TaskList({
  tasks,
  selectedTaskId,
  onSelectTask
}: TaskListProps) {
  if (!tasks.length) {
    return (
      <div className={classes.emptyText}>
        No child tasks found for the current parent work item.
      </div>
    );
  }

  return (
    <div className={classes.list}>
      {tasks.map((task) => (
        <TaskButton
          key={task.id}
          task={task}
          isSelected={selectedTaskId === task.id}
          onSelectTask={onSelectTask}
        />
      ))}
    </div>
  );
}
