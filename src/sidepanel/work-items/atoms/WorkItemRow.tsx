import clsx from 'clsx';
import type { PullRequestRef, WorkItem } from '@/types';
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
        <WorkItemRowStatus item={item} linkExternal={linkExternal} />
      ) : null}
    </div>
  );
}

/**
 * The status slot. An open pull request says more about where the item stands
 * than its state does — "In Progress" is true of an item nobody has looked at
 * and of one sitting in review. Items here are closed when their PR merges, so
 * an open PR effectively means "in review", and an approved one means "ready to
 * merge". Falls back to the state text whenever there is no PR data, including
 * when PR reads are unavailable (a PAT without the code scope).
 */
function WorkItemRowStatus({
  item,
  linkExternal
}: {
  item: WorkItem;
  linkExternal: boolean;
}) {
  const [pullRequest, ...rest] = item.pullRequests ?? [];

  if (!pullRequest) {
    return (
      <span className={classes.state} title={item.state}>
        {item.state}
      </span>
    );
  }

  return (
    <Link
      className={clsx(classes.pr, prClassFor(pullRequest))}
      href={pullRequest.url}
      external={linkExternal}
      title={describePullRequest(pullRequest, rest)}
    >
      <span aria-hidden="true" className={classes.prMark}>
        {PR_MARKS[pullRequest.approval]}
      </span>
      {pullRequest.id}
    </Link>
  );
}

const PR_MARKS: Record<PullRequestRef['approval'], string> = {
  approved: '✔',
  'waiting-for-author': '↩',
  rejected: '✕',
  'no-vote': '⇅'
};

function prClassFor(pullRequest: PullRequestRef): string | undefined {
  if (pullRequest.isDraft) {
    return classes.prDraft;
  }
  switch (pullRequest.approval) {
    case 'approved':
      return classes.prApproved;
    case 'rejected':
      return classes.prRejected;
    case 'waiting-for-author':
      return classes.prWaiting;
    default:
      return undefined;
  }
}

function describePullRequest(
  pullRequest: PullRequestRef,
  others: PullRequestRef[]
): string {
  const state = pullRequest.isDraft
    ? 'draft'
    : PR_STATE_LABELS[pullRequest.approval];
  const extra = others.length
    ? ` (+${others.length} more open PR${others.length > 1 ? 's' : ''})`
    : '';
  return `PR ${pullRequest.id} — ${state} — ${pullRequest.repoName}: ${pullRequest.title}${extra}`;
}

const PR_STATE_LABELS: Record<PullRequestRef['approval'], string> = {
  approved: 'approved, awaiting merge',
  'waiting-for-author': 'waiting for author',
  rejected: 'rejected',
  'no-vote': 'in review, no votes yet'
};
