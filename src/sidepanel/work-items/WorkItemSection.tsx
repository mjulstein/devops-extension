import type { WorkItem } from '@/types';
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
        <div className="work-item-closed-groups">
          {groupClosedItems(items).map((group) => (
            <section key={group.key} className="work-item-closed-group">
              <div className="work-item-group-heading">
                <span>{group.label}</span>
                {onRefetchClosedDay ? (
                  <button
                    type="button"
                    className="work-item-group-refetch"
                    title={`Refetch closed items for ${group.label}`}
                    onClick={() => {
                      void onRefetchClosedDay(group.key);
                    }}
                  >
                    ↻
                  </button>
                ) : null}
              </div>

              <div className="work-item-grid" role="list">
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
        <div className="work-item-grid" role="list">
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
      className={`work-item-grid-row ${options.showState ? 'with-state' : 'without-state'}`}
      role="listitem"
    >
      <Link
        className="work-item-id"
        href={item.url}
        external={options.linkExternal}
      >
        {item.id}
      </Link>
      <span className="work-item-type" title={item.workItemType}>
        {item.workItemType}
      </span>
      <div className="work-item-main">
        <span
          className={`work-item-title ${emphasizeCompleted ? 'work-item-title-emphasis' : ''}`}
          title={item.title}
        >
          {item.title}
        </span>

        {options.showParentDetails && item.parent ? (
          <div className="work-item-parent-detail">
            <span className="work-item-parent-label">Parent:</span>{' '}
            <span
              className="work-item-parent-type"
              title={item.parent.workItemType}
            >
              {item.parent.workItemType}
            </span>{' '}
            <Link
              className="work-item-parent-link"
              href={item.parent.url}
              external={options.linkExternal}
            >
              #{item.parent.id}
            </Link>{' '}
            <span className="work-item-parent-title" title={item.parent.title}>
              {item.parent.title}
            </span>
          </div>
        ) : null}
      </div>
      {options.showState ? (
        <span className="work-item-state" title={item.state}>
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
