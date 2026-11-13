import classes from './DeduplicateTabsButton.module.css';
import { Button } from './Button';

interface WindowDeckButtonProps {
  onClick: () => void;
}

/**
 * Opens the deck of open windows.
 *
 * The Tabs tab is about what is open; this is about where to go next, and the
 * two want different shapes — a deck parked down the side of a screen, against
 * a panel docked to a browser window. So it is its own window, one instance,
 * raised rather than reopened.
 */
export function WindowDeckButton({ onClick }: WindowDeckButtonProps) {
  return (
    <Button
      description="Open the window deck"
      onClick={onClick}
      icon={
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={classes.icon}
          aria-hidden="true"
        >
          <rect x="1.5" y="3.5" width="9" height="7" rx="1" />
          <path d="M5.5 12.5h7a1 1 0 0 0 1-1v-6" />
        </svg>
      }
    />
  );
}
