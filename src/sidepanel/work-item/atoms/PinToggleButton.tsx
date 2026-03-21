import clsx from 'clsx';
import { PinIcon } from '../PinIcon';
import classes from './PinToggleButton.module.css';

interface PinToggleButtonProps {
  isPinned: boolean;
  pinLabel: string;
  unpinLabel: string;
  onClick: () => void;
}

export function PinToggleButton({
  isPinned,
  pinLabel,
  unpinLabel,
  onClick
}: PinToggleButtonProps) {
  const label = isPinned ? unpinLabel : pinLabel;

  return (
    <button
      type="button"
      className={clsx(
        classes.button,
        isPinned ? classes.pinned : classes.unpinned
      )}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <PinIcon isPinned={isPinned} className={classes.icon} />
    </button>
  );
}
