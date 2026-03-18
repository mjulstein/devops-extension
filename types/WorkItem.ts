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
  url: string;
}

