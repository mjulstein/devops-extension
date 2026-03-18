import type { Settings } from './Settings';

export type WorkItemsFetchScope = 'all' | 'closed';

export interface ClosedDateRange {
  start: string;
  end: string;
}

export interface FetchWorkItemsRequest {
  settings: Settings;
  closedDateRange: ClosedDateRange;
  scope: WorkItemsFetchScope;
}

