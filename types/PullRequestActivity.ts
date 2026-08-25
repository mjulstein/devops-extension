import type { PullRequestApproval } from './PullRequestRef';

export type PullRequestStatus = 'active' | 'completed' | 'abandoned';

/** Why a pull request earned its place in the PRs tab. */
export interface PullRequestInvolvement {
  authoredByMe: boolean;
  commentedByMe: boolean;
  mentionsMe: boolean;
}

export interface PullRequestActivityItem {
  id: number;
  url: string;
  title: string;
  repoName: string;
  status: PullRequestStatus;
  isDraft: boolean;
  approval: PullRequestApproval;
  /** Epoch ms of the most recent thing that happened here that concerns me. */
  lastActivityAt: number;
  /** Epoch ms of my most recent comment, when I have commented. */
  lastCommentedAt: number | null;
  involvement: PullRequestInvolvement;
}
