import type { Settings, WorkItem, WorkItemResult } from '@/types';
import { getOrganizationAndProjectFromUrl } from './urlContext';

export async function fetchWorkItems(
  settings: Settings
): Promise<WorkItemResult> {
  const assignedTo = settings.assignedTo.trim();
  const { organization, project } = getOrganizationAndProjectFromUrl(
    window.location.href
  );

  if (!assignedTo) {
    throw new Error('Missing assignedTo in settings.');
  }

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekAgoString = formatDateForWiql(weekAgo);

  const wiql = `
    SELECT
      [System.Id]
    FROM WorkItems
    WHERE
      [System.TeamProject] = @project
      AND [System.AssignedTo] = '${escapeWiqlString(assignedTo)}'
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

  const wiqlData = await wiqlResponse.json();
  const ids = (wiqlData.workItems || []).map((item: { id: number }) => item.id);

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
  const allItems: any[] = [];

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

    const workItemsData = await workItemsResponse.json();
    allItems.push(...(workItemsData.value || []));
  }

  const items: WorkItem[] = allItems.map((item) => {
    const id = item.fields['System.Id'];
    const workItemType = item.fields['System.WorkItemType'] || '';
    const title = (item.fields['System.Title'] || '').trim();
    const state = item.fields['System.State'] || '';
    const assignedToValue = normalizeAssignedTo(
      item.fields['System.AssignedTo']
    );
    const parentId = item.fields['System.Parent'] || null;
    const closedDate = item.fields['Microsoft.VSTS.Common.ClosedDate'] || null;
    const url = `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`;

    return {
      id,
      workItemType,
      title,
      state,
      assignedTo: assignedToValue,
      parentId,
      closedDate,
      url
    };
  });

  const openItems = items.filter((item) => item.closedDate === null);
  const closedItems = items
    .filter((item) => item.closedDate !== null)
    .sort(
      (left, right) =>
        getClosedDateTimestamp(right.closedDate) -
        getClosedDateTimestamp(left.closedDate)
    );

  return {
    count: items.length,
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

function normalizeAssignedTo(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return String(record.displayName ?? record.uniqueName ?? '');
  }

  return String(value);
}

function getClosedDateTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
