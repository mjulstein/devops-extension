import classes from './ActiveWorkItemBanner.module.css';

interface ActiveWorkItemBannerProps {
  heading: string;
  isPinned: boolean;
  onClick: () => void;
}

export function ActiveWorkItemBanner({
  heading,
  isPinned,
  onClick
}: ActiveWorkItemBannerProps) {
  return (
    <button
      type="button"
      className={classes.banner}
      title={
        isPinned
          ? 'Pinned: click to open this work item'
          : 'Click to resync from the active Azure DevOps page state'
      }
      onClick={onClick}
    >
      <span className={classes.label}>
        {isPinned
          ? 'Active item (pinned: click to open)'
          : 'Active item (click to resync)'}
      </span>
      <span className={classes.title}>{heading}</span>
    </button>
  );
}
