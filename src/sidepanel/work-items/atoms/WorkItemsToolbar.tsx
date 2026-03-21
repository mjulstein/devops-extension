import clsx from 'clsx';
import classes from './WorkItemsToolbar.module.css';

interface WorkItemsToolbarProps {
  showWorkItemParentDetails: boolean;
  isActionDisabled: boolean;
  onFetchWorkItems: () => Promise<void>;
  onToggleShowWorkItemParentDetails: () => Promise<void>;
}

export function WorkItemsToolbar({
  showWorkItemParentDetails,
  isActionDisabled,
  onFetchWorkItems,
  onToggleShowWorkItemParentDetails
}: WorkItemsToolbarProps) {
  return (
    <div className={classes.row}>
      <button
        className={classes.button}
        onClick={() => {
          void onFetchWorkItems();
        }}
        disabled={isActionDisabled}
      >
        Fetch work items
      </button>

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
