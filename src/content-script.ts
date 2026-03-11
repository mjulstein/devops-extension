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

  const workItemType = await getWorkItemType(organization, project, workItemId);

  if (!isSupportedParentType(workItemType)) {
    throw new Error(
      `Current item type is "${workItemType}". Only Bug, Product Backlog Item, PBI, or Improvement can be a parent.`
    );
  }

  return {
    organization,
    project,
    parentId: workItemId
  };
}

async function createChildTask(rawTitle: string): Promise<CreatedChildTask> {
  const title = rawTitle.trim();

  if (!title) {
    throw new Error('Enter a task title before creating.');
  }

  const context = await getActiveWorkItemContext();
  const parentApiUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    `/_apis/wit/workItems/${context.parentId}`;

  const createUrl =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    '/_apis/wit/workitems/$Task?api-version=7.0';

  const response = await fetch(createUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json-patch+json'
    },
    body: JSON.stringify([
      {
        op: 'add',
        path: '/fields/System.Title',
        value: title
      },
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: parentApiUrl
        }
      }
    ])
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

async function getWorkItemType(
  organization: string,
  project: string,
  workItemId: number
): Promise<string> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${workItemId}?fields=${encodeURIComponent('System.WorkItemType')}` +
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

  if (!isObject(data)) {
    return '';
  }

  const fields = data.fields;
  if (!isObject(fields)) {
    return '';
  }

  const workItemType = fields['System.WorkItemType'];
  return typeof workItemType === 'string' ? workItemType.trim() : '';
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
