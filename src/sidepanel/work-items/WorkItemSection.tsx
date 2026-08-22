import type { WorkItem } from '@/types';
import classes from './WorkItemSection.module.css';
import { ClosedDateGroup } from './atoms/ClosedDateGroup';
import { ParentGroupSection } from './atoms/ParentGroupSection';
import { groupClosedItems, groupItemsByParent } from './atoms/workItemGrouping';
import { WorkItemRow } from './atoms/WorkItemRow';

interface WorkItemSectionProps {
  title: string;
  showTitle?: boolean;
  emptyText: string;
  items: WorkItem[];
  showState?: boolean;
  showParentDetails?: boolean;
  groupByClosedDate?: boolean;
  groupByParent?: boolean;
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
  groupByParent = false,
  onRefetchClosedDay,
  linkExternal
}: WorkItemSectionProps) {
  return (
    <>
      {showTitle ? <h3>{title}</h3> : null}
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : groupByParent ? (
        <div>
          {groupItemsByParent(items).map((group) => (
            <ParentGroupSection
              key={group.key}
              group={group}
              showState={showState}
              linkExternal={linkExternal}
            />
          ))}
        </div>
      ) : groupByClosedDate ? (
        <div className={classes.workItemClosedGroups}>
          {groupClosedItems(items).map((group) => (
            <ClosedDateGroup
              key={group.key}
              group={group}
              showState={showState}
              showParentDetails={showParentDetails}
              linkExternal={linkExternal}
              onRefetchClosedDay={onRefetchClosedDay}
            />
          ))}
        </div>
      ) : (
        <div className={classes.workItemGrid} role="list">
          {items.map((item) => (
            <WorkItemRow
              key={item.id}
              item={item}
              showState={showState}
              showParentDetails={showParentDetails}
              linkExternal={linkExternal}
            />
          ))}
        </div>
      )}
    </>
  );
}
