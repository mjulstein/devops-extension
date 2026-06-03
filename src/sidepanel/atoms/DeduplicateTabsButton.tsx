import classes from './DeduplicateTabsButton.module.css';

interface DeduplicateTabsButtonProps {
  onClick: () => void;
}

export function DeduplicateTabsButton({ onClick }: DeduplicateTabsButtonProps) {
  return (
    <button
      type="button"
      className={classes.button}
      aria-label="Close duplicate tabs"
      title="Close duplicate tabs (keeps most recently active)"
      onClick={onClick}
    >
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
    </button>
  );
}
