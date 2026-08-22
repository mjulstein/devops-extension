import type {
  FetchWorkItemsRequest,
  WorkItem,
  WorkItemParentSummary,
  WorkItemResult
} from '@/types';
import { authFetch } from './authFetch';
import {
  extractPullRequestIds,
  fetchActivePullRequests,
  selectActivePullRequests
} from './pullRequests';

export interface WorkItemsContext {
  organization: string;
  project: string;
}

const DEFAULT_TODO_STATES = ['To Do', 'In Progress'];

export async function fetchWorkItems(
  request: FetchWorkItemsRequest,
  context: WorkItemsContext
): Promise<WorkItemResult> {
  const assignedTo = request.settings.assignedTo.trim();
  const organization = context.organization.trim();
  const project = context.project.trim();
  const closedDateRange = normalizeClosedDateRange(request.closedDateRange);
  const scope = request.scope;
  const todoStates = getEffectiveTodoStates(request.settings.todoStates);

  if (!organization || !project) {
    throw new Error(
      'Missing organization/project context for work-item fetch.'
    );
  }

  const assignedToClause = buildAssignedToClause(assignedTo);
  const openItemsPromise =
    scope === 'all'
      ? fetchOpenItems(organization, project, assignedToClause, todoStates)
      : Promise.resolve([]);
  const closedItemsPromise = fetchClosedItems(
    organization,
    project,
    assignedToClause,
    closedDateRange.start,
    closedDateRange.end
  );

  const [openItems, closedItems] = await Promise.all([
    openItemsPromise,
    closedItemsPromise
  ]);

  // Enrich open items with hasIncompleteChildren flag after both fetches complete
  const openItemsWithChildren = await attachHasIncompleteChildren(
    openItems,
    context.organization,
    context.project
  );

  return {
    count: openItemsWithChildren.length + closedItems.length,
    openItems: openItemsWithChildren,
    closedItems,
    closedDateRange: {
      start: formatDateForInput(closedDateRange.start),
      end: formatDateForInput(closedDateRange.end)
    }
  };
}

async function fetchOpenItems(
  organization: string,
  project: string,
  assignedToClause: string,
  todoStates: string[]
): Promise<WorkItem[]> {
  return fetchOpenItemsForWiql(
    organization,
    project,
    `
      SELECT
        [System.Id]
      FROM WorkItems
      WHERE
        [System.TeamProject] = @project
        AND [System.AssignedTo] = ${assignedToClause}
        AND ${buildTodoStateClause(todoStates)}
      ORDER BY [System.ChangedDate] DESC
    `
  );
}

/**
 * Work items the user authored that are still open, excluding anything assigned
 * to them — those already appear in the TODO list, and the point of this view is
 * work you started but someone else now owns.
 *
 * Unassigned items are deliberately kept: in WIQL a `<>` comparison excludes
 * empty values, so they need an explicit escape hatch or authored-but-unassigned
 * work would silently vanish.
 */
export async function fetchAuthoredWorkItems(
  request: FetchWorkItemsRequest,
  context: WorkItemsContext
): Promise<WorkItem[]> {
  const organization = context.organization.trim();
  const project = context.project.trim();

  if (!organization || !project) {
    throw new Error(
      'Missing organization/project context for authored work-item fetch.'
    );
  }

  const assignedToClause = buildAssignedToClause(
    request.settings.assignedTo.trim()
  );

  return fetchOpenItemsForWiql(
    organization,
    project,
    `
      SELECT
        [System.Id]
      FROM WorkItems
      WHERE
        [System.TeamProject] = @project
        AND [System.CreatedBy] = @Me
        AND [System.State] NOT IN ('Done', 'Closed', 'Removed')
        AND (
          [System.AssignedTo] <> ${assignedToClause}
          OR [System.AssignedTo] = ''
        )
      ORDER BY [System.ChangedDate] DESC
    `
  );
}

/**
 * The Closed list, rolled up to finished deliverables.
 *
 * Individual closed tasks are noise when reviewing what actually shipped: what
 * matters is whether the parent they belong to is *done*. So this returns
 *
 *   - parents of the closed tasks that have **no remaining open children**, and
 *   - closed non-task items with no parent, which are the deliverable themselves.
 *
 * A parent that still has open tasks is deliberately absent: the work is not
 * finished, however many of its tasks closed in the range.
 *
 * Each returned item carries an *effective* closedDate — the parent's own, or
 * failing that the latest closed date among its children in range — so the
 * existing date grouping keeps working and a parent lands on the day its work
 * actually finished.
 */
export async function fetchClosedParentRollup(
  request: FetchWorkItemsRequest,
  context: WorkItemsContext
): Promise<WorkItem[]> {
  const organization = context.organization.trim();
  const project = context.project.trim();

  if (!organization || !project) {
    throw new Error(
      'Missing organization/project context for closed rollup fetch.'
    );
  }

  const closedDateRange = normalizeClosedDateRange(request.closedDateRange);
  const assignedToClause = buildAssignedToClause(
    request.settings.assignedTo.trim()
  );

  const closedItems = await fetchClosedItems(
    organization,
    project,
    assignedToClause,
    closedDateRange.start,
    closedDateRange.end
  );

  // Latest closed date seen per parent, used when the parent itself is not closed.
  const latestChildClosedByParent = new Map<number, string>();
  const standalone: WorkItem[] = [];

  for (const item of closedItems) {
    if (item.parentId === null) {
      // Tasks are the noise this view exists to remove; anything else with no
      // parent is a deliverable in its own right.
      if (item.workItemType.trim().toLowerCase() !== 'task') {
        standalone.push(item);
      }
      continue;
    }

    const current = latestChildClosedByParent.get(item.parentId);
    if (item.closedDate && (!current || item.closedDate > current)) {
      latestChildClosedByParent.set(item.parentId, item.closedDate);
    }
  }

  const parentIds = Array.from(latestChildClosedByParent.keys());
  const finishedParents: WorkItem[] = [];

  if (parentIds.length) {
    // Relations come back with the parents themselves, so this costs two
    // requests rather than one per parent.
    const childIdsByParent = new Map<number, number[]>();
    const parents = await fetchWorkItemDetails(
      parentIds,
      organization,
      project,
      WORK_ITEM_FIELDS,
      { withRelations: true, collectChildIds: childIdsByParent }
    );

    const allChildIds = Array.from(
      new Set(Array.from(childIdsByParent.values()).flat())
    );
    const openChildIds = new Set<number>();

    if (allChildIds.length) {
      const children = await fetchWorkItemDetails(
        allChildIds,
        organization,
        project,
        ['System.Id', 'System.State', 'System.WorkItemType']
      );
      for (const child of children) {
        if (!isCompletedState(child.state)) {
          openChildIds.add(child.id);
        }
      }
    }

    for (const parent of parents) {
      // Every child type counts here, not only Tasks: an umbrella Feature whose
      // children are PBIs has no Task children at all, and treating that as
      // "finished" would surface work that has barely started.
      const children = childIdsByParent.get(parent.id) ?? [];
      if (children.some((childId) => openChildIds.has(childId))) {
        continue;
      }
      finishedParents.push({
        ...parent,
        closedDate:
          parent.closedDate ?? latestChildClosedByParent.get(parent.id) ?? null
      });
    }
  }

  return [...finishedParents, ...standalone].sort(compareClosedItemsByDateDesc);
}

function isCompletedState(state: string): boolean {
  const normalized = state.trim().toLowerCase();
  return normalized === 'done' || normalized === 'closed';
}

/** Child work-item ids from a payload's hierarchy relations. */
function extractHierarchyChildIds(relations: unknown): number[] {
  if (!Array.isArray(relations)) {
    return [];
  }

  const ids: number[] = [];
  for (const relation of relations) {
    if (
      !isRecord(relation) ||
      relation.rel !== 'System.LinkTypes.Hierarchy-Forward' ||
      typeof relation.url !== 'string'
    ) {
      continue;
    }
    const match = /\/workItems\/(\d+)$/i.exec(relation.url);
    if (!match) {
      continue;
    }
    const id = Number(match[1]);
    if (Number.isInteger(id) && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function compareClosedItemsByDateDesc(a: WorkItem, b: WorkItem): number {
  const left = a.closedDate ?? '';
  const right = b.closedDate ?? '';
  if (left === right) {
    return b.id - a.id;
  }
  return left < right ? 1 : -1;
}

/**
 * Shared pipeline for every "still open" list: resolve ids, fetch details with
 * relations (which carry the pull-request links), attach the open PRs, then
 * enrich parents.
 */
async function fetchOpenItemsForWiql(
  organization: string,
  project: string,
  wiql: string
): Promise<WorkItem[]> {
  const ids = await queryWorkItemIds(organization, project, wiql);

  // Relations are requested only for open items: they carry the pull-request
  // links, and the closed list has no use for them (or for the extra payload).
  const pullRequestIdsByItem = new Map<number, number[]>();
  const items = await fetchWorkItemDetails(
    ids,
    organization,
    project,
    WORK_ITEM_FIELDS,
    { withRelations: true, collectPullRequestIds: pullRequestIdsByItem }
  );

  const withPullRequests = await attachPullRequests(
    items,
    pullRequestIdsByItem,
    organization,
    project
  );

  return enrichParents(withPullRequests, organization, project).then(
    (enriched) =>
      enriched.filter((item) => item.closedDate === null).sort(compareOpenItems)
  );
}

async function attachHasIncompleteChildren(
  items: WorkItem[],
  organization: string,
  project: string
): Promise<WorkItem[]> {
  const parentIds = items.map((i) => i.id);
  const childIdMap = await fetchChildIdsForParents(
    parentIds,
    organization,
    project
  );

  // Flatten all child ids we need to fetch details for
  const allChildIds = Array.from(
    new Set(Array.from(childIdMap.values()).flat())
  );

  const incompleteMap = new Map<number, boolean>();

  if (allChildIds.length) {
    const childDetails = await fetchWorkItemDetails(
      allChildIds,
      organization,
      project,
      ['System.Id', 'System.State', 'System.WorkItemType']
    );

    const stateById = new Map<number, { state: string; type: string }>();
    for (const child of childDetails) {
      stateById.set(child.id, { state: child.state, type: child.workItemType });
    }

    for (const [parentId, childIds] of childIdMap.entries()) {
      let hasIncomplete = false;
      for (const cid of childIds) {
        const info = stateById.get(cid);
        if (!info) {
          continue;
        }

        // Consider child only if it's a Task work item type
        if (info.type.trim().toLowerCase() !== 'task') {
          continue;
        }

        const normalized = info.state.trim().toLowerCase();
        if (normalized !== 'done' && normalized !== 'closed') {
          hasIncomplete = true;
          break;
        }
      }

      incompleteMap.set(parentId, hasIncomplete);
    }
  }

  return items.map((item) => ({
    ...item,
    hasIncompleteChildren: incompleteMap.get(item.id) ?? false
  }));
}

async function fetchChildIdsForParents(
  parentIds: number[],
  organization: string,
  project: string
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();

  // For each parent, fetch its relations to extract child ids.
  // This could be optimized by batching if API supported expanding multiple items, but keep simple for now.
  const promises = parentIds.map(async (pid) => {
    try {
      const url =
        `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
        `/_apis/wit/workitems/${pid}?$expand=relations&api-version=7.0`;
      const resp = await authFetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (!resp.ok) {
        return [pid, []] as const;
      }

      const data: unknown = await resp.json();
      if (!isRecord(data) || !Array.isArray(data.relations)) {
        return [pid, []] as const;
      }

      const childIds: number[] = [];
      for (const rel of data.relations) {
        if (
          !isRecord(rel) ||
          rel.rel !== 'System.LinkTypes.Hierarchy-Forward' ||
          typeof rel.url !== 'string'
        ) {
          continue;
        }

        const match = /\/workItems\/(\d+)$/i.exec(rel.url);
        if (!match) {
          continue;
        }

        const parsed = Number(match[1]);
        if (Number.isFinite(parsed)) {
          childIds.push(parsed);
        }
      }

      return [pid, childIds] as const;
    } catch {
      return [pid, []] as const;
    }
  });

  const results = await Promise.all(promises);
  for (const [pid, ids] of results) {
    map.set(pid, [...ids]);
  }

  return map;
}

async function fetchClosedItems(
  organization: string,
  project: string,
  assignedToClause: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<WorkItem[]> {
  const closedRangeStart = formatDateForWiql(rangeStart);
  const closedRangeEndExclusive = formatDateForWiql(addDays(rangeEnd, 1));
  const closedIds = await queryWorkItemIds(
    organization,
    project,
    `
      SELECT
        [System.Id]
      FROM WorkItems
      WHERE
        [System.TeamProject] = @project
        AND [System.AssignedTo] = ${assignedToClause}
        AND [System.State] IN ('Done', 'Closed')
        AND [Microsoft.VSTS.Common.ClosedDate] >= '${closedRangeStart}'
        AND [Microsoft.VSTS.Common.ClosedDate] < '${closedRangeEndExclusive}'
      ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
    `
  );

  const closedItems = await fetchWorkItemDetails(
    closedIds,
    organization,
    project
  );

  return enrichParents(closedItems, organization, project).then((items) =>
    items.filter((item) => item.closedDate !== null).sort(compareClosedItems)
  );
}

async function queryWorkItemIds(
  organization: string,
  project: string,
  wiql: string
): Promise<number[]> {
  const wiqlUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`;

  const wiqlResponse = await authFetch(wiqlUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: wiql })
  });

  if (!wiqlResponse.ok) {
    const text = await wiqlResponse.text();
    throw new Error(
      `WIQL failed: HTTP ${wiqlResponse.status} ${wiqlResponse.statusText}\n${text}`
    );
  }

  const wiqlData: unknown = await wiqlResponse.json();
  return extractWorkItemIdsFromWiql(wiqlData);
}

async function fetchWorkItemDetails(
  ids: number[],
  organization: string,
  project: string,
  fields = WORK_ITEM_FIELDS,
  options: {
    withRelations?: boolean;
    /** Filled with itemId -> linked pull-request ids when `withRelations`. */
    collectPullRequestIds?: Map<number, number[]>;
    /** Filled with itemId -> child work-item ids when `withRelations`. */
    collectChildIds?: Map<number, number[]>;
  } = {}
): Promise<WorkItem[]> {
  if (!ids.length) {
    return [];
  }

  const idChunks = chunkArray(ids, 50);
  const allItems: WorkItem[] = [];
  const linkedPullRequestIds = options.collectPullRequestIds;
  const linkedChildIds = options.collectChildIds;

  for (const chunk of idChunks) {
    // Azure DevOps rejects `fields` together with `$expand`, so asking for
    // relations means taking the full field set for those items.
    const projection = options.withRelations
      ? '&$expand=relations'
      : `&fields=${encodeURIComponent(fields.join(','))}`;

    const workItemsUrl =
      `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
      `/_apis/wit/workitems?ids=${chunk.join(',')}` +
      projection +
      '&api-version=7.0';

    const workItemsResponse = await authFetch(workItemsUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!workItemsResponse.ok) {
      const text = await workItemsResponse.text();
      throw new Error(
        `Work items fetch failed: HTTP ${workItemsResponse.status} ${workItemsResponse.statusText}\n${text}`
      );
    }

    const workItemsData: unknown = await workItemsResponse.json();
    const payloads = extractWorkItemPayloads(workItemsData);

    for (const payload of payloads) {
      const parsed = toWorkItem(payload, organization, project);
      if (parsed) {
        if (linkedPullRequestIds) {
          const relationIds = extractPullRequestIds(payload.relations);
          if (relationIds.length) {
            linkedPullRequestIds.set(parsed.id, relationIds);
          }
        }
        if (linkedChildIds) {
          const childIds = extractHierarchyChildIds(payload.relations);
          if (childIds.length) {
            linkedChildIds.set(parsed.id, childIds);
          }
        }
        allItems.push(parsed);
      }
    }
  }

  return allItems;
}

/**
 * Attaches each item's still-open pull requests. Best-effort by design: when PR
 * data cannot be read (for example a PAT that predates the `vso.code` scope and
 * returns 401), items come back untouched and the row shows state instead.
 */
async function attachPullRequests(
  items: WorkItem[],
  linked: Map<number, number[]>,
  organization: string,
  project: string
): Promise<WorkItem[]> {
  if (!linked.size) {
    return items;
  }

  const activeById = await fetchActivePullRequests(organization, project);
  if (!activeById.size) {
    return items;
  }

  return items.map((item) => {
    const ids = linked.get(item.id);
    if (!ids?.length) {
      return item;
    }
    const pullRequests = selectActivePullRequests(ids, activeById);
    return pullRequests.length ? { ...item, pullRequests } : item;
  });
}

async function enrichParents(
  items: WorkItem[],
  organization: string,
  project: string
): Promise<WorkItem[]> {
  const parentIds = Array.from(
    new Set(
      items
        .map((item) => item.parentId)
        .filter((parentId): parentId is number => typeof parentId === 'number')
    )
  );

  if (!parentIds.length) {
    return items;
  }

  const parentItems = await fetchWorkItemDetails(
    parentIds,
    organization,
    project,
    PARENT_FIELDS
  );
  const parentMap = new Map<number, WorkItemParentSummary>(
    parentItems.map((item) => [
      item.id,
      {
        id: item.id,
        title: item.title,
        workItemType: item.workItemType,
        url: item.url
      }
    ])
  );

  return items.map((item) => ({
    ...item,
    parent:
      item.parentId !== null ? (parentMap.get(item.parentId) ?? null) : null
  }));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function formatDateForWiql(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateForInput(date: Date): string {
  return formatDateForWiql(date);
}

function escapeWiqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function getEffectiveTodoStates(extraStates: string[]): string[] {
  const combined = [...DEFAULT_TODO_STATES, ...extraStates];
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const entry of combined) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

function buildTodoStateClause(states: string[]): string {
  return `[System.State] IN (${states
    .map((state) => `'${escapeWiqlString(state)}'`)
    .join(', ')})`;
}

function buildAssignedToClause(assignedTo: string): string {
  if (!assignedTo) {
    return '@Me';
  }

  return `'${escapeWiqlString(assignedTo)}'`;
}

function normalizeAssignedTo(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (isRecord(value)) {
    const displayName = value.displayName;
    if (typeof displayName === 'string') {
      return displayName;
    }

    const uniqueName = value.uniqueName;
    if (typeof uniqueName === 'string') {
      return uniqueName;
    }

    return '';
  }

  return '';
}

function getClosedDateTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function compareOpenItems(left: WorkItem, right: WorkItem): number {
  // Primary: open state sort weight (preserve grouping like To Do, In Progress)
  const stateWeight =
    getOpenStateSortWeight(left.state) - getOpenStateSortWeight(right.state);
  if (stateWeight !== 0) {
    return stateWeight;
  }

  // Secondary: last changed date ascending so the most-recently changed items end up at the bottom
  const leftTs = left.lastChangedDate
    ? new Date(left.lastChangedDate).getTime()
    : 0;
  const rightTs = right.lastChangedDate
    ? new Date(right.lastChangedDate).getTime()
    : 0;

  if (leftTs !== rightTs) {
    return leftTs - rightTs;
  }

  // Tertiary: deterministic by id
  return left.id - right.id;
}

function compareClosedItems(left: WorkItem, right: WorkItem): number {
  return (
    getClosedDateTimestamp(right.closedDate) -
      getClosedDateTimestamp(left.closedDate) || right.id - left.id
  );
}

function getOpenStateSortWeight(state: string): number {
  const normalized = state.trim().toLowerCase();

  if (normalized === 'to do') {
    return 0;
  }

  // Treat 'In Progress' as the highest weight so it appears last in the TODO list.
  if (normalized === 'in progress') {
    return 2;
  }

  // Other open states come between To Do and In Progress.
  return 1;
}

function normalizeClosedDateRange(
  range: FetchWorkItemsRequest['closedDateRange']
) {
  const start = parseDateInputValue(range.start);
  const end = parseDateInputValue(range.end);

  if (!start || !end || start.getTime() > end.getTime()) {
    throw new Error(
      'Closed date range is invalid. Choose a valid start and end date.'
    );
  }

  return { start, end };
}

function parseDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearString, monthString, dayString] = value.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function extractWorkItemIdsFromWiql(data: unknown): number[] {
  if (!isRecord(data) || !Array.isArray(data.workItems)) {
    return [];
  }

  const ids: number[] = [];

  for (const item of data.workItems) {
    if (!isRecord(item)) {
      continue;
    }

    const id = item.id;
    if (typeof id === 'number' && Number.isFinite(id)) {
      ids.push(id);
    }
  }

  return ids;
}

function extractWorkItemPayloads(data: unknown): Record<string, unknown>[] {
  if (!isRecord(data) || !Array.isArray(data.value)) {
    return [];
  }

  return data.value.filter((entry): entry is Record<string, unknown> =>
    isRecord(entry)
  );
}

function toWorkItem(
  item: Record<string, unknown>,
  organization: string,
  project: string
): WorkItem | null {
  const fieldsUnknown = item.fields;
  if (!isRecord(fieldsUnknown)) {
    return null;
  }

  // With an explicit `fields=` projection Azure DevOps echoes System.Id inside
  // `fields`, but with `$expand=relations` it does not — the id is then only on
  // the payload itself. Accept either, or every expanded item fails to parse.
  const idField = fieldsUnknown['System.Id'];
  const id =
    typeof idField === 'number' && Number.isFinite(idField)
      ? idField
      : typeof item.id === 'number' && Number.isFinite(item.id)
        ? item.id
        : null;

  if (id === null) {
    return null;
  }

  const workItemTypeRaw = fieldsUnknown['System.WorkItemType'];
  const titleRaw = fieldsUnknown['System.Title'];
  const stateRaw = fieldsUnknown['System.State'];
  const assignedToRaw = fieldsUnknown['System.AssignedTo'];
  const parentIdRaw = fieldsUnknown['System.Parent'];
  const closedDateRaw = fieldsUnknown['Microsoft.VSTS.Common.ClosedDate'];
  const changedDateRaw = fieldsUnknown['System.ChangedDate'];

  const workItemType =
    typeof workItemTypeRaw === 'string' ? workItemTypeRaw : '';
  const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
  const state = typeof stateRaw === 'string' ? stateRaw : '';
  const assignedTo = normalizeAssignedTo(assignedToRaw);
  const parentId = typeof parentIdRaw === 'number' ? parentIdRaw : null;
  const closedDate = typeof closedDateRaw === 'string' ? closedDateRaw : null;
  const lastChangedDate =
    typeof changedDateRaw === 'string' ? changedDateRaw : null;
  const url = `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`;

  return {
    id,
    workItemType,
    title,
    state,
    assignedTo,
    parentId,
    parent: null,
    closedDate,
    lastChangedDate,
    url
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const WORK_ITEM_FIELDS = [
  'System.Id',
  'System.WorkItemType',
  'System.Title',
  'System.State',
  'System.AssignedTo',
  'System.Parent',
  'Microsoft.VSTS.Common.ClosedDate',
  // Include last changed date so client can sort by recent activity
  'System.ChangedDate'
];

const PARENT_FIELDS = ['System.Id', 'System.WorkItemType', 'System.Title'];
