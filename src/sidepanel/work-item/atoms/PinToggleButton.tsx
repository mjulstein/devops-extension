import clsx from 'clsx';
import { PinIcon } from '../PinIcon';
import classes from './PinToggleButton.module.css';
import { Button } from '@/sidepanel/atoms/Button';

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
    <Button
      variant="quiet"
      size="compact"
      description={label}
      isPressed={isPinned}
      className={clsx(isPinned ? classes.pinned : classes.unpinned)}
      onClick={onClick}
      icon={<PinIcon isPinned={isPinned} className={classes.icon} />}
    />
  );
}
