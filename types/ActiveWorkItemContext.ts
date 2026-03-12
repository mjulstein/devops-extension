export interface ActiveWorkItemSummary {
  id: number;
  title: string;
  workItemType: string;
  url: string;
}

export interface ActiveWorkItemContext {
  organization: string;
  project: string;
  parentId: number | null;
  parent: ActiveWorkItemSummary | null;
  viewedTaskId: number | null;
  current: ActiveWorkItemSummary;
}
