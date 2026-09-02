import clsx from 'clsx';
import type { PullRequestActivityItem } from '@/types';
import { Link } from '@/sidepanel/Link';
import classes from './PullRequestList.module.css';

const MARKS: Record<PullRequestActivityItem['approval'], string> = {
  approved: '✔',
  'waiting-for-author': '↩',
  rejected: '✕',
  'no-vote': '⇅'
};

interface PullRequestListProps {
  items: PullRequestActivityItem[];
  emptyText: string;
  linkExternal: boolean;
}

export function PullRequestList({
  items,
  emptyText,
  linkExternal
}: PullRequestListProps) {
  if (items.length === 0) {
    return <p>{emptyText}</p>;
  }

  return (
    <div className={classes.list} role="list">
      {items.map((item) => (
        <PullRequestRow key={item.id} item={item} linkExternal={linkExternal} />
      ))}
    </div>
  );
}

function PullRequestRow({
  item,
  linkExternal
}: {
  item: PullRequestActivityItem;
  linkExternal: boolean;
}) {
  const isOpen = item.status === 'active';

  return (
    <div className={classes.row} role="listitem">
      <span
        aria-hidden="true"
        className={clsx(classes.mark, markClassFor(item))}
        title={describeState(item)}
      >
        {MARKS[item.approval]}
      </span>
      <Link className={classes.id} href={item.url} external={linkExternal}>
        {item.id}
      </Link>
      <div className={classes.main}>
        <span
          className={clsx(classes.title, !isOpen && classes.titleClosed)}
          title={item.title}
        >
          {item.title}
        </span>
        <span className={classes.meta}>
          {/* Why this PR is in the list — the whole point of the tab. */}
          {/* Assigned first: it is why the row is at the top of the list. */}
          {item.involvement.assignedToMe && item.status === 'active' && (
            <span className={clsx(classes.tag, classes.tagAssigned)}>
              assigned to me
            </span>
          )}
          {item.involvement.authoredByMe && (
            <span className={clsx(classes.tag, classes.tagMine)}>mine</span>
          )}
          {item.involvement.mentionsMe && (
            <span className={clsx(classes.tag, classes.tagMention)}>
              mentioned
            </span>
          )}
          {item.involvement.commentedByMe && !item.involvement.authoredByMe && (
            <span className={classes.tag}>commented</span>
          )}
          {!isOpen && <span className={classes.tag}>{item.status}</span>}
          {item.isDraft && <span className={classes.tag}>draft</span>}
          {item.repoName}
        </span>
      </div>
    </div>
  );
}

function markClassFor(item: PullRequestActivityItem): string | undefined {
  if (item.isDraft || item.status !== 'active') {
    return classes.draft;
  }
  switch (item.approval) {
    case 'approved':
      return classes.approved;
    case 'rejected':
      return classes.rejected;
    case 'waiting-for-author':
      return classes.waiting;
    default:
      return undefined;
  }
}

function describeState(item: PullRequestActivityItem): string {
  const labels: Record<PullRequestActivityItem['approval'], string> = {
    approved: 'approved, awaiting merge',
    'waiting-for-author': 'waiting for author',
    rejected: 'rejected',
    'no-vote': 'in review, no votes yet'
  };
  const state = item.isDraft ? 'draft' : labels[item.approval];
  return `PR ${item.id} — ${item.status} — ${state} — ${item.repoName}`;
}
