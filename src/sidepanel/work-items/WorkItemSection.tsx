import clsx from 'clsx';
import type { WorkItem } from '@/types';
import classes from './WorkItemSection.module.css';
import { Link } from '../Link';

interface WorkItemSectionProps {
  title: string;
  showTitle?: boolean;
  emptyText: string;
  items: WorkItem[];
  showState?: boolean;
  showParentDetails?: boolean;
  groupByClosedDate?: boolean;
  onRefetchClosedDay?: (date: string) => Promise<void>;
  linkExternal: boolean;
}

export function WorkItemSection({
  title,
  showTitle = true,
  emptyText,
  items,
  showState = true,
  showParentDetails = false,
  groupByClosedDate = false,
  onRefetchClosedDay,
  linkExternal
}: WorkItemSectionProps) {
  return (
    <>
      {showTitle ? <h3>{title}</h3> : null}
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : groupByClosedDate ? (
        <div className={classes.workItemClosedGroups}>
          {groupClosedItems(items).map((group) => (
            <section key={group.key} className={classes.workItemClosedGroup}>
              <div className={classes.workItemGroupHeading}>
                <span>{group.label}</span>
                {onRefetchClosedDay ? (
                  <button
                    type="button"
                    className={classes.workItemGroupRefetch}
                    title={`Refetch closed items for ${group.label}`}
                    onClick={() => {
                      void onRefetchClosedDay(group.key);
                    }}
                  >
                    ↻
                  </button>
                ) : null}
              </div>

              <div className={classes.workItemGrid} role="list">
                {group.items.map((item) =>
                  renderWorkItemRow(item, {
                    showState,
                    showParentDetails,
                    linkExternal
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={classes.workItemGrid} role="list">
          {items.map((item) =>
            renderWorkItemRow(item, {
              showState,
              showParentDetails,
              linkExternal
            })
          )}
        </div>
      )}
    </>
  );
}

function renderWorkItemRow(
  item: WorkItem,
  options: {
    showState: boolean;
    showParentDetails: boolean;
    linkExternal: boolean;
  }
) {
  const emphasizeCompleted = shouldEmphasizeCompletedItem(item);

  return (
    <div
      key={item.id}
      className={clsx(
        classes.workItemGridRow,
        options.showState ? classes.withState : classes.withoutState
      )}
      role="listitem"
    >
      <Link
        className={classes.workItemId}
        href={item.url}
        external={options.linkExternal}
      >
        {item.id}
      </Link>
      <span className={classes.workItemType} title={item.workItemType}>
        {item.workItemType}
      </span>
      <div className={classes.workItemMain}>
        <span
          className={clsx(
            classes.workItemTitle,
            emphasizeCompleted && classes.workItemTitleEmphasis
          )}
          title={item.title}
        >
          {item.title}
        </span>

        {options.showParentDetails && item.parent ? (
          <div className={classes.workItemParentDetail}>
            <span className={classes.workItemParentLabel}>Parent:</span>{' '}
            <span
              className={classes.workItemParentType}
              title={item.parent.workItemType}
            >
              {item.parent.workItemType}
            </span>{' '}
            <Link
              className={classes.workItemParentLink}
              href={item.parent.url}
              external={options.linkExternal}
            >
              #{item.parent.id}
            </Link>{' '}
            <span
              className={classes.workItemParentTitle}
              title={item.parent.title}
            >
              {item.parent.title}
            </span>
          </div>
        ) : null}
      </div>
      {options.showState ? (
        <span className={classes.workItemState} title={item.state}>
          {item.state}
        </span>
      ) : null}
    </div>
  );
}

function groupClosedItems(items: WorkItem[]) {
  const groups: {
    key: string;
    label: string;
    items: WorkItem[];
  }[] = [];
  const byKey = new Map<
    string,
    { key: string; label: string; items: WorkItem[] }
  >();

  for (const item of items) {
    const group = getClosedGroup(item.closedDate);
    const existing = byKey.get(group.key);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    const next = {
      ...group,
      items: [item]
    };
    byKey.set(group.key, next);
    groups.push(next);
  }

  return groups;
}

function getClosedGroup(value: string | null): { key: string; label: string } {
  if (!value) {
    return {
      key: 'unknown',
      label: 'Unknown date'
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      key: value,
      label: value
    };
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    label: date.toLocaleDateString()
  };
}

function shouldEmphasizeCompletedItem(item: WorkItem): boolean {
  if (!item.closedDate) {
    return false;
  }

  const normalizedType = item.workItemType.trim().toLowerCase();
  return (
    normalizedType === 'bug' ||
    normalizedType === 'pbi' ||
    normalizedType === 'improvement' ||
    normalizedType === 'product backlog item'
  );
}
