import classes from './TaskStateFilters.module.css';
import { abbreviateTaskState } from './taskStateDisplay';

interface TaskStateFiltersProps {
  availableTaskStates: string[];
  hiddenTaskStates: string[];
  onToggleTaskStateFilter: (state: string, isChecked: boolean) => void;
}

export function TaskStateFilters({
  availableTaskStates,
  hiddenTaskStates,
  onToggleTaskStateFilter
}: TaskStateFiltersProps) {
  return (
    <div className={classes.row}>
      {availableTaskStates.map((state) => {
        const isChecked = !hiddenTaskStates.includes(state);
        return (
          <label key={state} className={classes.item} title={state}>
            <input
              className={classes.checkbox}
              type="checkbox"
              checked={isChecked}
              onChange={(event) =>
                onToggleTaskStateFilter(state, event.target.checked)
              }
            />
            <span>{abbreviateTaskState(state)}</span>
          </label>
        );
      })}
    </div>
  );
}
