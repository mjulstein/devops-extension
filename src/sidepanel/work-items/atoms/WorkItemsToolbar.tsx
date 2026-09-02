import clsx from 'clsx';
import classes from './WorkItemsToolbar.module.css';

interface WorkItemsToolbarProps {
  showWorkItemParentDetails: boolean;
  isActionDisabled: boolean;
  canCreateQuickTask: boolean;
  onFetchWorkItems: () => Promise<void>;
  onCreateQuickTask: () => Promise<void>;
  onToggleShowWorkItemParentDetails: () => Promise<void>;
}

export function WorkItemsToolbar({
  showWorkItemParentDetails,
  isActionDisabled,
  canCreateQuickTask,
  onFetchWorkItems,
  onCreateQuickTask,
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

      <button
        className={classes.button}
        onClick={() => {
          void onCreateQuickTask();
        }}
        disabled={isActionDisabled || !canCreateQuickTask}
        title={
          canCreateQuickTask
            ? 'Create an in-progress task from the current page, under the quick-task parent'
            : 'Set a quick-task parent work item id in Settings to enable this'
        }
      >
        + Task from page
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
