import clsx from 'clsx';
import type { WorkItem } from '@/types';
import { Link } from '@/sidepanel/Link';
import classes from './WorkItemRow.module.css';
import { shouldEmphasizeCompletedItem } from './workItemGrouping';

interface WorkItemRowProps {
  item: WorkItem;
  showState: boolean;
  showParentDetails: boolean;
  linkExternal: boolean;
}

export function WorkItemRow({
  item,
  showState,
  showParentDetails,
  linkExternal
}: WorkItemRowProps) {
  const emphasizeCompleted = shouldEmphasizeCompletedItem(item);
  const emphasizeIncompleteChildren = Boolean(item.hasIncompleteChildren);

  return (
    <div
      className={clsx(
        classes.row,
        showState ? classes.withState : classes.withoutState
      )}
      role="listitem"
    >
      <Link className={classes.id} href={item.url} external={linkExternal}>
        {item.id}
      </Link>
      <span className={classes.type} title={item.workItemType}>
        {item.workItemType}
      </span>
      <div className={classes.main}>
        <span
          className={clsx(
            classes.title,
            (emphasizeCompleted || emphasizeIncompleteChildren) &&
              classes.titleEmphasis
          )}
          title={item.title}
        >
          {item.title}
        </span>

        {showParentDetails && item.parent ? (
          <div className={classes.parentDetail}>
            <span className={classes.parentLabel}>Parent:</span>{' '}
            <span
              className={classes.parentType}
              title={item.parent.workItemType}
            >
              {item.parent.workItemType}
            </span>{' '}
            <Link
              className={classes.parentLink}
              href={item.parent.url}
              external={linkExternal}
            >
              #{item.parent.id}
            </Link>{' '}
            <span className={classes.parentTitle} title={item.parent.title}>
              {item.parent.title}
            </span>
          </div>
        ) : null}
      </div>
      {showState ? (
        <span className={classes.state} title={item.state}>
          {item.state}
        </span>
      ) : null}
    </div>
  );
}
