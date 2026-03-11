import type { WorkItem } from './WorkItem';

export interface WorkItemResult {
  count: number;
  openItems: WorkItem[];
  closedItems: WorkItem[];
}

