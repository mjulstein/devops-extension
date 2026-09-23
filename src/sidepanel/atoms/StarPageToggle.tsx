import clsx from 'clsx';
import classes from './StarPageToggle.module.css';
import { Button } from './Button';

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
    <Button
      icon={isStarred ? '★' : '☆'}
      description={
        canStar
          ? isStarred
            ? 'This page is a favorite — click to remove it'
            : 'Add this page to favorites'
          : 'Only Azure DevOps pages can be starred'
      }
      className={clsx(isStarred && classes.starred)}
      disabled={!canStar}
      isPressed={isStarred}
      onClick={() => {
        void onToggle();
      }}
    />
  );
}
