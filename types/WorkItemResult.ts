import type { WorkItem } from './WorkItem';
import type { ClosedDateRange } from './WorkItemsQuery';

export interface WorkItemResult {
  count: number;
  openItems: WorkItem[];
  closedItems: WorkItem[];
  closedDateRange: ClosedDateRange;
}

