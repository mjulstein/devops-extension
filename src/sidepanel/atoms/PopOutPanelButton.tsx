import classes from './DeduplicateTabsButton.module.css';
import { Button } from './Button';

interface PopOutPanelButtonProps {
  onClick: () => void;
}

/**
 * Moves the panel into a window of its own.
 *
 * The browser's side panel is fixed to one edge at a width it chooses; a window
 * can be put on a second screen and left there. Only one is ever open, the same
 * rule the bookmark manager follows: a second copy is a second view of the same
 * state, free to disagree with the first on screen.
 */
export function PopOutPanelButton({ onClick }: PopOutPanelButtonProps) {
  return (
    <Button
      description="Open the panel in its own window"
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
          <path d="M8.5 2.5H13.5V7.5" />
          <path d="M13.5 2.5 L7.5 8.5" />
          <path d="M11.5 9.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5h3.5" />
        </svg>
      }
    />
  );
}
