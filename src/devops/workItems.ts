import type { Settings, WorkItem, WorkItemResult } from '@/types';

export interface WorkItemsContext {
  organization: string;
  project: string;
}

export async function fetchWorkItems(
  settings: Settings,
  context: WorkItemsContext
): Promise<WorkItemResult> {
  const assignedTo = settings.assignedTo.trim();
  const organization = context.organization.trim();
  const project = context.project.trim();

  if (!organization || !project) {
    throw new Error(
      'Missing organization/project context for work-item fetch.'
    );
  }

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekAgoString = formatDateForWiql(weekAgo);
  const assignedToClause = buildAssignedToClause(assignedTo);

  const wiql = `
    SELECT
      [System.Id]
    FROM WorkItems
    WHERE
      [System.TeamProject] = @project
      AND [System.AssignedTo] = ${assignedToClause}
      AND (
        [System.State] IN ('To Do', 'In Progress')
        OR (
          [System.State] IN ('Done', 'Closed')
          AND [Microsoft.VSTS.Common.ClosedDate] >= '${weekAgoString}'
        )
      )
    ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
  `;

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
  const ids = extractWorkItemIdsFromWiql(wiqlData);

  if (!ids.length) {
    return {
      count: 0,
      openItems: [],
      closedItems: []
    };
  }

  const fields = [
    'System.Id',
    'System.WorkItemType',
    'System.Title',
    'System.State',
    'System.AssignedTo',
    'System.Parent',
    'Microsoft.VSTS.Common.ClosedDate'
  ];

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

  const openItems = allItems.filter((item) => item.closedDate === null);
  const closedItems = allItems
    .filter((item) => item.closedDate !== null)
    .sort(
      (left, right) =>
        getClosedDateTimestamp(right.closedDate) -
        getClosedDateTimestamp(left.closedDate)
    );

  return {
    count: allItems.length,
    openItems,
    closedItems
  };
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
    closedDate,
    url
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
