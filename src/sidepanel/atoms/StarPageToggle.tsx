import clsx from 'clsx';
import classes from './StarPageToggle.module.css';

interface StarPageToggleProps {
  /** The active tab is an Azure DevOps page, so it can be starred. */
  canStar: boolean;
  isStarred: boolean;
  onToggle: () => Promise<void>;
}

export function StarPageToggle({
  canStar,
  isStarred,
  onToggle
}: StarPageToggleProps) {
  return (
    <button
      type="button"
      className={clsx(classes.toggle, isStarred && classes.starred)}
      disabled={!canStar}
      aria-pressed={isStarred}
      title={
        canStar
          ? isStarred
            ? 'This page is a favorite — click to remove it'
            : 'Add this page to favorites'
          : 'Only Azure DevOps pages can be starred'
      }
      onClick={() => {
        void onToggle();
      }}
    >
      <span aria-hidden="true">{isStarred ? '★' : '☆'}</span>
    </button>
  );
}
