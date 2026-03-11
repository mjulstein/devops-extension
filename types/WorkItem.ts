export interface WorkItem {
  id: number;
  workItemType: string;
  title: string;
  state: string;
  assignedTo: string;
  parentId: number | null;
  closedDate: string | null;
  url: string;
}

