import type {
  FetchWorkItemsRequest,
  WorkItem,
  WorkItemParentSummary,
  WorkItemResult
} from '@/types';

export interface WorkItemsContext {
  organization: string;
  project: string;
}

export async function fetchWorkItems(
  request: FetchWorkItemsRequest,
  context: WorkItemsContext
): Promise<WorkItemResult> {
  const assignedTo = request.settings.assignedTo.trim();
  const organization = context.organization.trim();
  const project = context.project.trim();
  const closedDateRange = normalizeClosedDateRange(request.closedDateRange);
  const scope = request.scope;

  if (!organization || !project) {
    throw new Error(
      'Missing organization/project context for work-item fetch.'
    );
  }

  const assignedToClause = buildAssignedToClause(assignedTo);
  const openItemsPromise =
    scope === 'all'
      ? fetchOpenItems(organization, project, assignedToClause)
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

  return {
    count: openItems.length + closedItems.length,
    openItems,
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
  assignedToClause: string
): Promise<WorkItem[]> {
  const openIds = await queryWorkItemIds(
    organization,
    project,
    `
      SELECT
        [System.Id]
      FROM WorkItems
      WHERE
        [System.TeamProject] = @project
        AND [System.AssignedTo] = ${assignedToClause}
        AND [System.State] IN ('To Do', 'In Progress')
      ORDER BY [System.ChangedDate] DESC
    `
  );

  const openItems = await fetchWorkItemDetails(openIds, organization, project);

  return enrichParents(openItems, organization, project).then((items) =>
    items.filter((item) => item.closedDate === null).sort(compareOpenItems)
  );
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

  const wiqlResponse = await fetch(wiqlUrl, {
    method: 'POST',
    credentials: 'include',
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
  fields = WORK_ITEM_FIELDS
): Promise<WorkItem[]> {
  if (!ids.length) {
    return [];
  }

  const idChunks = chunkArray(ids, 50);
  const allItems: WorkItem[] = [];

  for (const chunk of idChunks) {
    const workItemsUrl =
      `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
      `/_apis/wit/workitems?ids=${chunk.join(',')}` +
      `&fields=${encodeURIComponent(fields.join(','))}` +
      '&api-version=7.0';

    const workItemsResponse = await fetch(workItemsUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
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
        allItems.push(parsed);
      }
    }
  }

  return allItems;
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
  return (
    getOpenStateSortWeight(left.state) - getOpenStateSortWeight(right.state)
  );
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

  if (normalized === 'in progress') {
    return 1;
  }

  return 2;
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

  const id = fieldsUnknown['System.Id'];
  if (typeof id !== 'number' || !Number.isFinite(id)) {
    return null;
  }

  const workItemTypeRaw = fieldsUnknown['System.WorkItemType'];
  const titleRaw = fieldsUnknown['System.Title'];
  const stateRaw = fieldsUnknown['System.State'];
  const assignedToRaw = fieldsUnknown['System.AssignedTo'];
  const parentIdRaw = fieldsUnknown['System.Parent'];
  const closedDateRaw = fieldsUnknown['Microsoft.VSTS.Common.ClosedDate'];

  const workItemType =
    typeof workItemTypeRaw === 'string' ? workItemTypeRaw : '';
  const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
  const state = typeof stateRaw === 'string' ? stateRaw : '';
  const assignedTo = normalizeAssignedTo(assignedToRaw);
  const parentId = typeof parentIdRaw === 'number' ? parentIdRaw : null;
  const closedDate = typeof closedDateRaw === 'string' ? closedDateRaw : null;
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
  'Microsoft.VSTS.Common.ClosedDate'
];

const PARENT_FIELDS = ['System.Id', 'System.WorkItemType', 'System.Title'];
