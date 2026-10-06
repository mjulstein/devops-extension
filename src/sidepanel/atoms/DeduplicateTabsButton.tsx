import classes from './DeduplicateTabsButton.module.css';
import { Button } from './Button';
import { STALE_TAB_DAYS } from '../staleTabs';

interface DeduplicateTabsButtonProps {
  onClick: () => void;
  onCloseStale: () => void;
}

/**
 * Two ways of tidying the tab strip, on one control.
 *
 * Right-click is a poor place to hide a feature, so the description says it is
 * there — that is the only thing making it findable. It shares this button
 * rather than taking one of its own because it is the same job: duplicates are
 * the same page twice, stale tabs are the pages you meant to come back to.
 */
export function DeduplicateTabsButton({
  onClick,
  onCloseStale
}: DeduplicateTabsButtonProps) {
  return (
    <Button
      description={`Close duplicate tabs (keeps most recently active). Right-click to close tabs untouched for ${STALE_TAB_DAYS} days.`}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onCloseStale();
      }}
      icon={
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          className={classes.icon}
          aria-hidden="true"
        >
          <rect
            x="1"
            y="4.5"
            width="9"
            height="8"
            rx="1.5"
            strokeDasharray="2 1.5"
          />
          <rect x="5.5" y="2" width="9" height="8" rx="1.5" />
          <path d="M1.75 6.5 L4.25 9 M4.25 6.5 L1.75 9" />
        </svg>
      }
    />
  );
}
