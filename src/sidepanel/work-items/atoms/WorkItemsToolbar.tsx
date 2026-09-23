import clsx from 'clsx';
import classes from './WorkItemsToolbar.module.css';

interface WorkItemsToolbarProps {
  showWorkItemParentDetails: boolean;
  onToggleShowWorkItemParentDetails: () => Promise<void>;
}

// There is no fetch button: selecting a tab refetches that tab, which makes a
// separate button redundant. Creating a quick task lives beside the quick-task
// input, next to the title it uses.
export function WorkItemsToolbar({
  showWorkItemParentDetails,
  onToggleShowWorkItemParentDetails
}: WorkItemsToolbarProps) {
  return (
    <div className={classes.row}>
      <label className={clsx(classes.checkboxToggle, classes.parentToggle)}>
        <input
          className={classes.checkboxInput}
          type="checkbox"
          checked={showWorkItemParentDetails}
          onChange={() => {
            void onToggleShowWorkItemParentDetails();
          }}
        />
        Show task parent details
      </label>
    </div>
  );
}
