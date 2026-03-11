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

export type ActiveWorkItemContext = {
  organization: string;
  project: string;
  parentId: number;
};

export type CreatedChildTask = {
  id: number;
  title: string;
  url: string;
  parentId: number;
};

export type ChildTaskItem = {
  id: number;
  title: string;
  state: string;
  url: string;
  parentId: number;
};

export type SidepanelTabId = 'settings' | 'work-items' | 'create-task';

export type RuntimeResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };
