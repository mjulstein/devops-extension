import clsx from 'clsx';
import { Link } from '@/sidepanel/Link';
import classes from './ParentGroupSection.module.css';
import type { ParentGroup } from './workItemGrouping';
import { WorkItemRow } from './WorkItemRow';

interface ParentGroupSectionProps {
  group: ParentGroup;
  showState: boolean;
  linkExternal: boolean;
}

export function ParentGroupSection({
  group,
  showState,
  linkExternal
}: ParentGroupSectionProps) {
  const { parent } = group;

  return (
    <div className={classes.group}>
      <div className={classes.header}>
        {parent ? (
          <>
            <Link
              className={classes.headerLink}
              href={parent.url}
              external={linkExternal}
            >
              {parent.id}
            </Link>
            <span className={classes.headerType} title={parent.workItemType}>
              {parent.workItemType}
            </span>
            <span className={classes.headerTitle} title={parent.title}>
              {parent.title}
            </span>
          </>
        ) : (
          <span className={clsx(classes.headerTitle, classes.headerFullRow)}>
            No parent
          </span>
        )}
      </div>

      <div className={classes.children} role="list">
        {group.items.map((item) => (
          <WorkItemRow
            key={item.id}
            item={item}
            showState={showState}
            // The parent is the group header now, so repeating it per row would
            // just be noise.
            showParentDetails={false}
            linkExternal={linkExternal}
          />
        ))}
      </div>
    </div>
  );
}
