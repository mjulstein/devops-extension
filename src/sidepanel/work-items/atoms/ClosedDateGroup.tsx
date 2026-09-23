import type { WorkItem } from '@/types';
import classes from './ClosedDateGroup.module.css';
import { Button } from '@/sidepanel/atoms/Button';
import { WorkItemRow } from './WorkItemRow';

interface ClosedDateGroupProps {
  group: {
    key: string;
    label: string;
    items: WorkItem[];
  };
  showState: boolean;
  showParentDetails: boolean;
  linkExternal: boolean;
  onRefetchClosedDay?: (date: string) => Promise<void>;
}

export function ClosedDateGroup({
  group,
  showState,
  showParentDetails,
  linkExternal,
  onRefetchClosedDay
}: ClosedDateGroupProps) {
  return (
    <section className={classes.group}>
      <div className={classes.heading}>
        <span>{group.label}</span>
        {onRefetchClosedDay ? (
          <Button
            variant="quiet"
            size="compact"
            icon="↻"
            description={`Refetch closed items for ${group.label}`}
            onClick={() => {
              void onRefetchClosedDay(group.key);
            }}
          />
        ) : null}
      </div>

      <div className={classes.list} role="list">
        {group.items.map((item) => (
          <WorkItemRow
            key={item.id}
            item={item}
            showState={showState}
            showParentDetails={showParentDetails}
            linkExternal={linkExternal}
          />
        ))}
      </div>
    </section>
  );
}
