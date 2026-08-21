import type { PullRequestRef } from './PullRequestRef';

export interface WorkItemParentSummary {
  id: number;
  title: string;
  workItemType: string;
  url: string;
}

export interface WorkItem {
  id: number;
  workItemType: string;
  title: string;
  state: string;
  assignedTo: string;
  parentId: number | null;
  parent: WorkItemParentSummary | null;
  closedDate: string | null;
  // ISO string of the last changed date from Azure DevOps (System.ChangedDate)
  lastChangedDate: string | null;
  // Whether this work item has at least one incomplete child task.
  hasIncompleteChildren?: boolean;
  /**
   * Active (open) pull requests linked to this item, newest first. Absent when
   * PR data could not be read — for example a PAT without the code scope — so
   * the UI falls back to showing the item state.
   */
  pullRequests?: PullRequestRef[];
  url: string;
}

