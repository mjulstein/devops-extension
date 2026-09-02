import type {
  ActiveWorkItemContext,
  ChildTaskItem,
  PullRequestActivityItem,
  PullRequestApproval,
  PullRequestRef,
  WorkItem,
  WorkItemResult
} from '@/types';

// Fixture data for the side-panel dev harness. Placeholders only — never real
// organization, project, or user values (see CLAUDE.md hard constraints).
export const DEV_ORGANIZATION = 'myorg';
export const DEV_PROJECT = 'myproj';

export type ScenarioId =
  | 'happy'
  | 'empty'
  | 'many'
  | 'reconnect-needed'
  | 'error'
  | 'slow';

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  /** Simulated round-trip latency for every runtime message, in ms. */
  latencyMs: number;
  /** When set, every data message resolves as `{ ok: false, error }`. */
  failWith?: string;
  connection: 'connected' | 'reconnect-needed';
  workItems: WorkItemResult;
  childTasks: ChildTaskItem[];
  activeContext: ActiveWorkItemContext | null;
  /** Lazily-loaded Authored tab contents. */
  authoredItems: WorkItem[];
  /** Lazily-loaded Closed rollup: parents with no remaining open tasks. */
  closedParentRollup: WorkItem[];
  /** Lazily-loaded PRs tab contents. */
  pullRequestActivity: PullRequestActivityItem[];
}

function url(id: number): string {
  return `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_workitems/edit/${id}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function pullRequest(
  id: number,
  approval: PullRequestApproval,
  overrides: Partial<PullRequestRef> = {}
): PullRequestRef {
  return {
    id,
    url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_git/some-repo/pullrequest/${id}`,
    title: `Pull request ${id}`,
    repoName: 'some-repo',
    isDraft: false,
    approval,
    createdAt: Date.now() - id,
    ...overrides
  };
}

function workItem(overrides: Partial<WorkItem> & { id: number }): WorkItem {
  return {
    workItemType: 'Task',
    title: `Work item ${overrides.id}`,
    state: 'Active',
    assignedTo: 'Dev User',
    parentId: null,
    parent: null,
    closedDate: null,
    lastChangedDate: daysAgo(1),
    url: url(overrides.id),
    ...overrides
  };
}

const parentSummary = {
  id: 1000,
  title: 'Make the side panel readable at a glance',
  workItemType: 'Product Backlog Item',
  url: url(1000)
};

const HAPPY_OPEN: WorkItem[] = [
  workItem({
    id: 1001,
    workItemType: 'Bug',
    title: 'Reconnect banner flashes on every panel open',
    state: 'In Progress',
    parentId: 1000,
    parent: parentSummary,
    hasIncompleteChildren: true,
    lastChangedDate: daysAgo(0),
    // Approved and waiting to merge — the state text would just say "In Progress".
    pullRequests: [pullRequest(41909, 'approved')]
  }),
  workItem({
    id: 1002,
    title: 'Group closed items by day',
    state: 'To Do',
    parentId: 1000,
    parent: parentSummary,
    // Two open PRs: the row links the oldest (the first incomplete one).
    pullRequests: [
      pullRequest(41820, 'no-vote'),
      pullRequest(41955, 'approved')
    ]
  }),
  workItem({
    id: 1003,
    workItemType: 'Product Backlog Item',
    title:
      'A deliberately long title that should wrap or truncate gracefully in a narrow side panel without pushing the layout sideways',
    state: 'To Do',
    lastChangedDate: daysAgo(9)
  }),
  workItem({
    id: 1004,
    workItemType: 'Bug',
    title: 'Reviewer asked for changes on the auth resync',
    state: 'In Progress',
    pullRequests: [pullRequest(41870, 'waiting-for-author')]
  }),
  workItem({
    id: 1005,
    title: 'Draft PR for the closed-items grouping',
    state: 'In Progress',
    pullRequests: [pullRequest(41888, 'no-vote', { isDraft: true })]
  }),
  workItem({
    id: 1006,
    workItemType: 'Bug',
    title: 'Rejected approach to tab dedup',
    state: 'In Progress',
    pullRequests: [pullRequest(41799, 'rejected')]
  })
];

const HAPPY_CLOSED: WorkItem[] = [
  workItem({
    id: 900,
    title: 'Dedupe Azure DevOps tabs',
    state: 'Closed',
    closedDate: daysAgo(0),
    lastChangedDate: daysAgo(0)
  }),
  workItem({
    id: 901,
    workItemType: 'Bug',
    title: 'Stale bearer token breaks the session',
    state: 'Closed',
    closedDate: daysAgo(1),
    lastChangedDate: daysAgo(1)
  }),
  workItem({
    id: 902,
    title: 'Section-specific tab icons',
    state: 'Closed',
    closedDate: daysAgo(3),
    lastChangedDate: daysAgo(3)
  })
];

const CHILD_TASKS: ChildTaskItem[] = [
  {
    id: 1101,
    title: 'Sketch the at-a-glance layout',
    state: 'Closed',
    url: url(1101),
    parentId: 1000
  },
  {
    id: 1102,
    title: 'Tighten the closed-items grouping',
    state: 'Active',
    url: url(1102),
    parentId: 1000
  }
];

const ACTIVE_CONTEXT: ActiveWorkItemContext = {
  organization: DEV_ORGANIZATION,
  project: DEV_PROJECT,
  parentId: 1000,
  parent: parentSummary,
  viewedTaskId: 1001,
  current: {
    id: 1001,
    title: 'Reconnect banner flashes on every panel open',
    workItemType: 'Bug',
    url: url(1001)
  }
};

function result(open: WorkItem[], closed: WorkItem[]): WorkItemResult {
  return {
    count: open.length + closed.length,
    openItems: open,
    closedItems: closed,
    closedDateRange: { start: daysAgo(7).slice(0, 10), end: daysAgo(0).slice(0, 10) }
  };
}

const EMPTY_RESULT = result([], []);

function activityPr(
  id: number,
  overrides: Partial<PullRequestActivityItem> = {}
): PullRequestActivityItem {
  return {
    id,
    url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_git/some-repo/pullrequest/${id}`,
    title: `Pull request ${id}`,
    repoName: 'some-repo',
    status: 'active',
    isDraft: false,
    approval: 'no-vote',
    lastActivityAt: Date.now() - id,
    lastCommentedAt: null,
    involvement: {
      authoredByMe: false,
      commentedByMe: false,
      mentionsMe: false,
      assignedToMe: false
    },
    ...overrides
  };
}

const PULL_REQUEST_ACTIVITY: PullRequestActivityItem[] = [
  activityPr(41960, {
    title: 'Waiting on my review — assigned to me',
    repoName: 'web-frontend',
    involvement: {
      authoredByMe: false,
      commentedByMe: false,
      mentionsMe: false,
      assignedToMe: true
    }
  }),
  activityPr(41943, {
    title: 'Add a bulk-upload modal',
    approval: 'approved',
    involvement: { authoredByMe: true, commentedByMe: true, mentionsMe: false, assignedToMe: false }
  }),
  activityPr(41310, {
    title: 'Fix a duplicated React key',
    repoName: 'reporting-frontend',
    involvement: { authoredByMe: false, commentedByMe: true, mentionsMe: false, assignedToMe: false },
    lastCommentedAt: Date.now() - 3 * 86400000
  }),
  activityPr(41631, {
    title: 'Delete a retired endpoint',
    repoName: 'portal-api',
    isDraft: true,
    involvement: { authoredByMe: false, commentedByMe: false, mentionsMe: true, assignedToMe: false }
  }),
  activityPr(41824, {
    title: 'Upgrade the design system package',
    repoName: 'lending-frontend',
    status: 'completed',
    approval: 'approved',
    involvement: { authoredByMe: true, commentedByMe: false, mentionsMe: false, assignedToMe: false }
  }),
  activityPr(41892, {
    title: 'Prepare the auth module for extraction',
    repoName: 'portal-frontend',
    status: 'abandoned',
    involvement: { authoredByMe: true, commentedByMe: false, mentionsMe: false, assignedToMe: false }
  })
];

const AUTHORED: WorkItem[] = [
  workItem({
    id: 1200,
    title: 'Spec the reconnect flow (handed to someone else)',
    state: 'To Do',
    parentId: 1000,
    parent: parentSummary
  }),
  workItem({
    id: 1201,
    workItemType: 'Bug',
    title: 'Tab icons flicker on first paint',
    state: 'In Progress',
    pullRequests: [pullRequest(41700, 'approved')]
  })
];

// Parents whose children are all done, plus a standalone closed deliverable.
const CLOSED_ROLLUP: WorkItem[] = [
  workItem({
    id: 1000,
    workItemType: 'Product Backlog Item',
    title: 'Make the side panel readable at a glance',
    state: 'Done',
    closedDate: daysAgo(0),
    lastChangedDate: daysAgo(0)
  }),
  workItem({
    id: 901,
    workItemType: 'Bug',
    title: 'Stale bearer token breaks the session',
    state: 'Closed',
    closedDate: daysAgo(1),
    lastChangedDate: daysAgo(1)
  })
];

function manyItems(): WorkItem[] {
  return Array.from({ length: 40 }, (_, index) =>
    workItem({
      id: 2000 + index,
      title: `Backlog item ${index + 1} — checking scroll and density`,
      state: index % 3 === 0 ? 'In Progress' : 'To Do'
    })
  );
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  happy: {
    id: 'happy',
    label: 'Happy path',
    description: 'Mixed open and closed items, active Bug in context.',
    latencyMs: 150,
    connection: 'connected',
    workItems: result(HAPPY_OPEN, HAPPY_CLOSED),
    childTasks: CHILD_TASKS,
    activeContext: ACTIVE_CONTEXT,
    authoredItems: AUTHORED,
    closedParentRollup: CLOSED_ROLLUP,
    pullRequestActivity: PULL_REQUEST_ACTIVITY,
  },
  empty: {
    id: 'empty',
    label: 'Empty',
    description: 'Nothing assigned — checks empty states.',
    latencyMs: 150,
    connection: 'connected',
    workItems: EMPTY_RESULT,
    childTasks: [],
    activeContext: null,
    authoredItems: AUTHORED,
    closedParentRollup: CLOSED_ROLLUP,
    pullRequestActivity: PULL_REQUEST_ACTIVITY,
  },
  many: {
    id: 'many',
    label: 'Many items',
    description: '40 open items — checks density and scrolling.',
    latencyMs: 150,
    connection: 'connected',
    workItems: result(manyItems(), HAPPY_CLOSED),
    childTasks: CHILD_TASKS,
    activeContext: ACTIVE_CONTEXT,
    authoredItems: AUTHORED,
    closedParentRollup: CLOSED_ROLLUP,
    pullRequestActivity: PULL_REQUEST_ACTIVITY,
  },
  'reconnect-needed': {
    id: 'reconnect-needed',
    label: 'Reconnect needed',
    description: 'Session signed out — checks the reconnect banner.',
    latencyMs: 150,
    connection: 'reconnect-needed',
    workItems: EMPTY_RESULT,
    childTasks: [],
    activeContext: null,
    authoredItems: AUTHORED,
    closedParentRollup: CLOSED_ROLLUP,
    pullRequestActivity: PULL_REQUEST_ACTIVITY,
  },
  error: {
    id: 'error',
    label: 'Error',
    description: 'Every data call fails — checks error surfaces.',
    latencyMs: 150,
    failWith: 'Simulated Azure DevOps failure (dev harness).',
    connection: 'connected',
    workItems: EMPTY_RESULT,
    childTasks: [],
    activeContext: null,
    authoredItems: AUTHORED,
    closedParentRollup: CLOSED_ROLLUP,
    pullRequestActivity: PULL_REQUEST_ACTIVITY,
  },
  slow: {
    id: 'slow',
    label: 'Slow (3s)',
    description: '3s latency — checks loading and skeleton states.',
    latencyMs: 3000,
    connection: 'connected',
    workItems: result(HAPPY_OPEN, HAPPY_CLOSED),
    childTasks: CHILD_TASKS,
    activeContext: ACTIVE_CONTEXT,
    authoredItems: AUTHORED,
    closedParentRollup: CLOSED_ROLLUP,
    pullRequestActivity: PULL_REQUEST_ACTIVITY,
  }
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];
