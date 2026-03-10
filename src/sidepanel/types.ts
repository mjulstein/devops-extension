export type Settings = {
  assignedTo: string;
};

export type WorkItem = {
  id: number;
  workItemType: string;
  title: string;
  state: string;
  assignedTo: string;
  parentId: number | null;
  closedDate: string | null;
  url: string;
};

export type WorkItemResult = {
  count: number;
  openItems: WorkItem[];
  closedItems: WorkItem[];
};

export type RuntimeResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };
