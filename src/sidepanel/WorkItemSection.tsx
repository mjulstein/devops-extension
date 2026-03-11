import type { WorkItem } from '@/types';
import { Link } from './Link';

interface WorkItemSectionProps {
  title: string;
  emptyText: string;
  items: WorkItem[];
  showClosedAt: boolean;
  showState?: boolean;
  linkExternal: boolean;
}

export function WorkItemSection({
  title,
  emptyText,
  items,
  showClosedAt,
  showState = true,
  linkExternal
}: WorkItemSectionProps) {
  return (
    <>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <div className="work-item-grid" role="list">
          {items.map((item) => {
            const rowClass = showClosedAt
              ? showState
                ? 'with-closed-at'
                : 'with-closed-at-no-state'
              : 'without-closed-at';

            return (
              <div
                key={item.id}
                className={`work-item-grid-row ${rowClass}`}
                role="listitem"
              >
                <Link
                  className="work-item-id"
                  href={item.url}
                  external={linkExternal}
                >
                  {item.id}
                </Link>
                <span className="work-item-type" title={item.workItemType}>
                  {item.workItemType}
                </span>
                <span className="work-item-title" title={item.title}>
                  {item.title}
                </span>
                {showState ? (
                  <span className="work-item-state" title={item.state}>
                    {item.state}
                  </span>
                ) : null}
                {showClosedAt ? (
                  <span className="work-item-closed-at">
                    {formatClosedAt(item.closedDate)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function formatClosedAt(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}
