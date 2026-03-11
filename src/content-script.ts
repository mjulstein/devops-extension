import { fetchWorkItems } from './devops/workItems';

type RuntimeMessage =
  | {
      type: 'FETCH_WORK_ITEMS';
      payload: {
        assignedTo: string;
      };
    }
  | {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT';
    }
  | {
      type: 'CREATE_CHILD_TASK';
      payload: {
        title: string;
      };
    }
  | {
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT';
    };

type ActiveWorkItemContext = {
  organization: string;
  project: string;
  parentId: number;
};

type CreatedChildTask = {
  id: number;
  title: string;
  url: string;
  parentId: number;
};

type ChildTaskItem = {
  id: number;
  title: string;
  state: string;
  url: string;
  parentId: number;
};

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'FETCH_WORK_ITEMS') {
      fetchWorkItems(message.payload)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'GET_ACTIVE_WORK_ITEM_CONTEXT') {
      getActiveWorkItemContext()
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'CREATE_CHILD_TASK') {
      createChildTask(message.payload.title)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT') {
      fetchChildTasksForCurrentParent()
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }
  }
);

async function getActiveWorkItemContext(): Promise<ActiveWorkItemContext> {
  const { organization, project } = getOrganizationAndProjectFromUrl(
    window.location.href
  );
  const workItemId = getWorkItemIdFromUrl(window.location.href);

  if (!workItemId) {
    throw new Error(
      'Could not detect a work item id from the current page. Open a Bug, PBI, or Improvement work item first.'
    );
  }

  const current = await getWorkItemDetails(organization, project, workItemId);

  if (isSupportedParentType(current.workItemType)) {
    return {
      organization,
      project,
      parentId: workItemId
    };
  }

  if (current.workItemType.toLowerCase() === 'task') {
    if (!current.parentId) {
      throw new Error(
        `Current item is Task #${workItemId} and has no parent work item.`
      );
    }

    const parent = await getWorkItemDetails(
      organization,
      project,
      current.parentId
    );

    if (!isSupportedParentType(parent.workItemType)) {
      throw new Error(
        `Current item is Task #${workItemId}, but its parent type is "${parent.workItemType}". Parent must be Bug, Product Backlog Item, PBI, or Improvement.`
      );
    }

    return {
      organization,
      project,
      parentId: current.parentId
    };
  }

  throw new Error(
    `Current item type is "${current.workItemType}". Only Bug, Product Backlog Item, PBI, or Improvement can be a parent.`
  );
}

async function createChildTask(rawTitle: string): Promise<CreatedChildTask> {
  const title = rawTitle.trim();

  if (!title) {
    throw new Error('Enter a task title before creating.');
  }

  const context = await getActiveWorkItemContext();
  const parentDetails = await getWorkItemDetails(
    context.organization,
    context.project,
    context.parentId
  );
  const parentApiUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    `/_apis/wit/workItems/${context.parentId}`;

  const createUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    '/_apis/wit/workitems/$Task?api-version=7.0';

  const patchOperations: Array<{
    op: 'add';
    path: string;
    value: string | { rel: string; url: string };
  }> = [
    {
      op: 'add',
      path: '/fields/System.Title',
      value: title
    }
  ];

  if (parentDetails.areaPath) {
    patchOperations.push({
      op: 'add',
      path: '/fields/System.AreaPath',
      value: parentDetails.areaPath
    });
  }

  if (parentDetails.iterationPath) {
    patchOperations.push({
      op: 'add',
      path: '/fields/System.IterationPath',
      value: parentDetails.iterationPath
    });
  }

  patchOperations.push({
    op: 'add',
    path: '/relations/-',
    value: {
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url: parentApiUrl
    }
  });

  const response = await fetch(createUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json-patch+json'
    },
    body: JSON.stringify(patchOperations)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Task creation failed: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data: unknown = await response.json();
  const id = getNumericIdFromResponse(data);

  if (!id) {
    throw new Error('Task created but response did not include a valid id.');
  }

  return {
    id,
    title,
    parentId: context.parentId,
    url: `https://dev.azure.com/${context.organization}/${context.project}/_workitems/edit/${id}`
  };
}

async function fetchChildTasksForCurrentParent(): Promise<ChildTaskItem[]> {
  const context = await getActiveWorkItemContext();
  const relationUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    `/_apis/wit/workitems/${context.parentId}?$expand=relations&api-version=7.0`;

  const relationResponse = await fetch(relationUrl, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!relationResponse.ok) {
    const text = await relationResponse.text();
    throw new Error(
      `Could not load child-task links: HTTP ${relationResponse.status} ${relationResponse.statusText}\n${text}`
    );
  }

  const relationData: unknown = await relationResponse.json();
  const childIds = extractChildIdsFromRelations(relationData);

  if (!childIds.length) {
    return [];
  }

  const childItems = await fetchTaskItemsByIds(
    context.organization,
    context.project,
    childIds,
    context.parentId
  );

  return childItems.sort(compareChildTasks);
}

async function getWorkItemDetails(
  organization: string,
  project: string,
  workItemId: number
): Promise<{
  workItemType: string;
  parentId: number | null;
  areaPath: string;
  iterationPath: string;
}> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${workItemId}?fields=${encodeURIComponent('System.WorkItemType,System.Parent,System.AreaPath,System.IterationPath')}` +
    '&api-version=7.0';

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Could not inspect the current work item: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data: unknown = await response.json();

  if (!isObject(data) || !isObject(data.fields)) {
    return {
      workItemType: '',
      parentId: null,
      areaPath: '',
      iterationPath: ''
    };
  }

  const workItemTypeRaw = data.fields['System.WorkItemType'];
  const parentIdRaw = data.fields['System.Parent'];
  const areaPathRaw = data.fields['System.AreaPath'];
  const iterationPathRaw = data.fields['System.IterationPath'];

  return {
    workItemType:
      typeof workItemTypeRaw === 'string' ? workItemTypeRaw.trim() : '',
    parentId: typeof parentIdRaw === 'number' ? parentIdRaw : null,
    areaPath: typeof areaPathRaw === 'string' ? areaPathRaw.trim() : '',
    iterationPath:
      typeof iterationPathRaw === 'string' ? iterationPathRaw.trim() : ''
  };
}

async function fetchTaskItemsByIds(
  organization: string,
  project: string,
  childIds: number[],
  parentId: number
): Promise<ChildTaskItem[]> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems?ids=${childIds.join(',')}` +
    `&fields=${encodeURIComponent('System.Id,System.Title,System.State,System.WorkItemType')}` +
    '&api-version=7.0';

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Could not load child-task details: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data: unknown = await response.json();
  if (!isObject(data) || !Array.isArray(data.value)) {
    return [];
  }

  const items: ChildTaskItem[] = [];

  for (const value of data.value) {
    if (!isObject(value) || !isObject(value.fields)) {
      continue;
    }

    const id = value.fields['System.Id'];
    const title = value.fields['System.Title'];
    const state = value.fields['System.State'];
    const workItemType = value.fields['System.WorkItemType'];

    if (
      typeof id !== 'number' ||
      typeof title !== 'string' ||
      typeof state !== 'string' ||
      typeof workItemType !== 'string'
    ) {
      continue;
    }

    if (workItemType.toLowerCase() !== 'task') {
      continue;
    }

    items.push({
      id,
      title,
      state,
      parentId,
      url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`
    });
  }

  return items;
}

function extractChildIdsFromRelations(data: unknown): number[] {
  if (!isObject(data) || !Array.isArray(data.relations)) {
    return [];
  }

  const ids: number[] = [];

  for (const relation of data.relations) {
    if (!isObject(relation)) {
      continue;
    }

    if (relation.rel !== 'System.LinkTypes.Hierarchy-Forward') {
      continue;
    }

    if (typeof relation.url !== 'string') {
      continue;
    }

    const idMatch = /\/workItems\/(\d+)$/i.exec(relation.url);
    if (!idMatch) {
      continue;
    }

    const parsed = Number(idMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      ids.push(parsed);
    }
  }

  return ids;
}

function compareChildTasks(left: ChildTaskItem, right: ChildTaskItem): number {
  return (
    getStateSortWeight(left.state) -
      getStateSortWeight(right.state) ||
    left.state.localeCompare(right.state) ||
    right.id - left.id
  );
}

function getStateSortWeight(state: string): number {
  const normalized = state.trim().toLowerCase();
  return normalized === 'to do' || normalized === 'todo' || normalized === 'new'
    ? 0
    : 1;
}

function getWorkItemIdFromUrl(rawUrl: string): number | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  const editMatch = /\/_workitems\/edit\/(\d+)/i.exec(parsedUrl.pathname);
  if (editMatch) {
    return Number(editMatch[1]);
  }

  const candidates = [
    parsedUrl.searchParams.get('id'),
    parsedUrl.searchParams.get('workitem'),
    parsedUrl.searchParams.get('workItem'),
    parsedUrl.searchParams.get('workItemId'),
    ...getHashParamCandidates(parsedUrl.hash)
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Last-resort fallback for URLs where id appears only inside a hash route chunk.
  const hashIdMatch = /(?:^|[?&/#])(?:id|workitem|workItem|workItemId)=(\d+)(?:[&#/]|$)/i.exec(
    parsedUrl.hash
  );
  if (hashIdMatch) {
    const parsed = Number(hashIdMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getHashParamCandidates(rawHash: string): Array<string | null> {
  if (!rawHash) {
    return [];
  }

  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const queryStart = hash.indexOf('?');

  if (queryStart < 0) {
    return [];
  }

  const hashParams = new URLSearchParams(hash.slice(queryStart + 1));
  return [
    hashParams.get('id'),
    hashParams.get('workitem'),
    hashParams.get('workItem'),
    hashParams.get('workItemId')
  ];
}


function getNumericIdFromResponse(data: unknown): number | null {
  if (!isObject(data)) {
    return null;
  }

  const idValue = data.id;
  if (typeof idValue !== 'number' || !Number.isFinite(idValue)) {
    return null;
  }

  return idValue;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSupportedParentType(workItemType: string): boolean {
  const normalized = workItemType.toLowerCase();
  return (
    normalized === 'bug' ||
    normalized === 'pbi' ||
    normalized === 'product backlog item' ||
    normalized === 'improvement'
  );
}

function getOrganizationAndProjectFromUrl(rawUrl: string): {
  organization: string;
  project: string;
} {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('Could not parse the current page URL.');
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean);

  if (segments.length < 2) {
    throw new Error(
      'Could not derive organization/project from URL. Open a project page in Azure DevOps.'
    );
  }

  return {
    organization: decodeURIComponent(segments[0]),
    project: decodeURIComponent(segments[1])
  };
}
