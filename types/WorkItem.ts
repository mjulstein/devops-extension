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
  url: string;
}

