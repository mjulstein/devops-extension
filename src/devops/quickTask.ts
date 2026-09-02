import type { CreatedChildTask } from '@/types';
import { authFetch } from './authFetch';
import { fetchIdentity } from './identity';
import { getNumericIdFromResponse } from './typeGuards';
import { getWorkItemDetails } from './workItemDetails';

// "Quick task": one click turns whatever page you are looking at into a task
// under a fixed catch-all work item, already in progress and assigned to you.
//
// It replaces a manual sequence — open the catch-all item, add a child task,
// type a title, copy the page URL, paste it into the description, save.

/** Tasks are created directly in progress; nothing here is ever a to-do. */
const IN_PROGRESS_STATE = 'In Progress';
// Azure DevOps rejects System.Title over 255 characters.
const MAX_TITLE_LENGTH = 255;

export function buildQuickTaskTitle(pageTitle: string): string {
  const collapsed = pageTitle.replace(/\s+/g, ' ').trim();
  if (!collapsed) {
    return '';
  }
  return collapsed.length > MAX_TITLE_LENGTH
    ? `${collapsed.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : collapsed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Description holding a link back to the originating page. System.Description is
 * HTML, so both the href and the link text are escaped — a page title is
 * arbitrary text from an arbitrary site.
 */
export function buildQuickTaskDescription(
  pageTitle: string,
  pageUrl: string
): string {
  const url = pageUrl.trim();
  if (!url) {
    return '';
  }
  const label = buildQuickTaskTitle(pageTitle) || url;
  return `<div><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></div>`;
}

export interface QuickTaskRequest {
  organization: string;
  project: string;
  parentId: number;
  pageTitle: string;
  pageUrl: string;
  /** Explicit assignee override; falls back to the signed-in identity. */
  assignedTo?: string;
}

export async function createQuickTask(
  request: QuickTaskRequest
): Promise<CreatedChildTask> {
  const { organization, project, parentId, pageTitle, pageUrl } = request;

  if (!organization || !project) {
    throw new Error('Missing organization/project context for quick task.');
  }
  if (!Number.isInteger(parentId) || parentId <= 0) {
    throw new Error(
      'Set a quick-task parent work item id in Settings before using this.'
    );
  }

  const title = buildQuickTaskTitle(pageTitle);
  if (!title) {
    throw new Error(
      'The active page has no title to use, so there is nothing to name the task.'
    );
  }

  // Inherit area/iteration from the parent so the task lands on the same board.
  const parentDetails = await getWorkItemDetails(
    organization,
    project,
    parentId
  );

  // The assignee comes from settings. An explicit `assignedTo` wins; when it is
  // blank the signed-in user is resolved at runtime, matching how an empty
  // `assignedTo` already means "the current user" everywhere else. No identity
  // is ever hardcoded.
  let assignedTo = request.assignedTo?.trim() ?? '';
  if (!assignedTo) {
    const identity = await fetchIdentity(organization);
    assignedTo = identity?.uniqueName ?? '';
  }

  const operations: {
    op: 'add';
    path: string;
    value: string | { rel: string; url: string };
  }[] = [
    { op: 'add', path: '/fields/System.Title', value: title },
    { op: 'add', path: '/fields/System.State', value: IN_PROGRESS_STATE }
  ];

  if (assignedTo) {
    operations.push({
      op: 'add',
      path: '/fields/System.AssignedTo',
      value: assignedTo
    });
  }

  const description = buildQuickTaskDescription(pageTitle, pageUrl);
  if (description) {
    operations.push({
      op: 'add',
      path: '/fields/System.Description',
      value: description
    });
  }

  if (parentDetails.areaPath) {
    operations.push({
      op: 'add',
      path: '/fields/System.AreaPath',
      value: parentDetails.areaPath
    });
  }
  if (parentDetails.iterationPath) {
    operations.push({
      op: 'add',
      path: '/fields/System.IterationPath',
      value: parentDetails.iterationPath
    });
  }

  operations.push({
    op: 'add',
    path: '/relations/-',
    value: {
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url:
        `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
        `/_apis/wit/workItems/${parentId}`
    }
  });

  const response = await authFetch(
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
      '/_apis/wit/workitems/$Task?api-version=7.0',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json-patch+json'
      },
      body: JSON.stringify(operations)
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Quick task creation failed: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const id = getNumericIdFromResponse(await response.json());
  if (!id) {
    throw new Error('Quick task created but the response had no valid id.');
  }

  return {
    id,
    title,
    parentId,
    url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`
  };
}
