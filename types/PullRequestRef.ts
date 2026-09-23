/**
 * Review state of a pull request, derived from its reviewer votes.
 * Azure DevOps vote values: 10 approved, 5 approved with suggestions,
 * 0 no vote, -5 waiting for author, -10 rejected.
 */
export type PullRequestApproval =
  | 'approved'
  | 'waiting-for-author'
  | 'rejected'
  | 'no-vote';

/** An *active* (open) pull request linked to a work item. */
export interface PullRequestRef {
  id: number;
  /** Web URL for a human to open, not the REST url. */
  url: string;
  title: string;
  repoName: string;
  isDraft: boolean;
  approval: PullRequestApproval;
  /** Creation time (epoch ms) — orders the item's open PRs oldest-first. */
  createdAt: number;
}
