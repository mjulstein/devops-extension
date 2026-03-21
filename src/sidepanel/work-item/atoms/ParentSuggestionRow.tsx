import clsx from 'clsx';
import { Link } from '../../Link';
import classes from './ParentSuggestionRow.module.css';
import { PinToggleButton } from './PinToggleButton';

interface ParentSuggestionRowProps {
  id: number;
  title: string;
  url: string;
  workItemType: string;
  isPinned: boolean;
  actionLabel: string;
  onAction: () => void;
  onTogglePin: () => void;
  linkExternal: boolean;
  isActionDisabled?: boolean;
  isCurrentParent?: boolean;
  pinLabel: string;
  unpinLabel: string;
}

export function ParentSuggestionRow({
  id,
  title,
  url,
  workItemType,
  isPinned,
  actionLabel,
  onAction,
  onTogglePin,
  linkExternal,
  isActionDisabled = false,
  isCurrentParent = false,
  pinLabel,
  unpinLabel
}: ParentSuggestionRowProps) {
  return (
    <div className={classes.row}>
      <Link
        href={url}
        external={linkExternal}
        className={clsx(classes.link, isCurrentParent && classes.linkSelected)}
        title={title}
      >
        #{id} [{workItemType}] - {title}
      </Link>

      <button
        type="button"
        className={classes.action}
        disabled={isActionDisabled}
        onClick={onAction}
      >
        {actionLabel}
      </button>

      <PinToggleButton
        isPinned={isPinned}
        pinLabel={pinLabel}
        unpinLabel={unpinLabel}
        onClick={onTogglePin}
      />
    </div>
  );
}
