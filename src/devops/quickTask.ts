import type { CreatedChildTask } from '@/types';
import { authFetch } from './authFetch';
import { fetchIdentity } from './identity';
import { getNumericIdFromResponse } from './typeGuards';
import { getWorkItemDetails } from './workItemDetails';
import { reparentWorkItem } from './reparentWorkItem';

// "Quick task": one click turns whatever page you are looking at into a task
// under a fixed catch-all work item, already in progress and assigned to you.
//
// It replaces a manual sequence — open the catch-all item, add a child task,
// type a title, copy the page URL, paste it into the description, save.

// Azure DevOps limits a *new* work item's State to the type's initial state, so
// setting "In Progress" during creation is rejected:
//   "The field 'State' contains the value 'In Progress' that is not in the list
//    of supported values"  (fieldStatusFlags: limitedToValues, invalidListValue)
// The task is therefore created first and transitioned immediately afterwards.
//
// The target state is discovered from the work-item type rather than hardcoded,
// so a process that names its in-progress state differently still works.
const IN_PROGRESS_CATEGORY = 'InProgress';
const TASK_TYPE = 'Task';
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

/** Picks the state whose category means "being worked on". */
export function pickInProgressState(states: unknown): string | null {
  if (!Array.isArray(states)) {
    return null;
  }
  for (const state of states) {
    if (!state || typeof state !== 'object') {
      continue;
    }
    const { name, category } = state as { name?: unknown; category?: unknown };
    if (category === IN_PROGRESS_CATEGORY && typeof name === 'string' && name) {
      return name;
    }
  }
  return null;
}

async function fetchInProgressState(
  organization: string,
  project: string
): Promise<string | null> {
  try {
    const response = await authFetch(
      `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
        `/_apis/wit/workitemtypes/${TASK_TYPE}/states?api-version=7.0`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    );
    if (!response.ok) {
      return null;
    }
    const data: unknown = await response.json();
    return pickInProgressState(
      data && typeof data === 'object'
        ? (data as { value?: unknown }).value
        : null
    );
  } catch {
    return null;
  }
}

export interface CreatedQuickTask extends CreatedChildTask {
  /** State the task ended up in — the transition is best-effort. */
  state: string;
}

export interface QuickTaskRequest {
  organization: string;
  project: string;
  parentId: number;
  /**
   * Title typed by the user. When given it wins over the page title, and no
   * description link is written — a typed task is not about a page.
   */
  title?: string;
  pageTitle: string;
  pageUrl: string;
  /** Explicit assignee override; falls back to the signed-in identity. */
  assignedTo?: string;
}

export async function createQuickTask(
  request: QuickTaskRequest
): Promise<CreatedQuickTask> {
  const { organization, project, parentId, pageTitle, pageUrl } = request;

  if (!organization || !project) {
    throw new Error('Missing organization/project context for quick task.');
  }
  if (!Number.isInteger(parentId) || parentId <= 0) {
    throw new Error(
      'Set a quick-task parent work item id in Settings before using this.'
    );
  }

  const typedTitle = buildQuickTaskTitle(request.title ?? '');
  const title = typedTitle || buildQuickTaskTitle(pageTitle);
  if (!title) {
    throw new Error(
      'Type a task title, or open a page with a title to capture.'
    );
  }

  // Parent details give the area/iteration to inherit so the task lands on the
  // same board; the state lookup is independent, so both run together.
  const [parentDetails, inProgressState] = await Promise.all([
    getWorkItemDetails(organization, project, parentId),
    fetchInProgressState(organization, project)
  ]);

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
  }[] = [{ op: 'add', path: '/fields/System.Title', value: title }];

  if (assignedTo) {
    operations.push({
      op: 'add',
      path: '/fields/System.AssignedTo',
      value: assignedTo
    });
  }

  // A typed task has no originating page, so it gets no link.
  const description = typedTitle
    ? ''
    : buildQuickTaskDescription(pageTitle, pageUrl);
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

  const created: unknown = await response.json();
  const id = getNumericIdFromResponse(created);
  if (!id) {
    throw new Error('Quick task created but the response had no valid id.');
  }

  // Transition after creation. Best-effort: the task already exists, so a failed
  // transition must not read as a failed creation — it is reported instead.
  let state = readState(created);
  if (inProgressState && state !== inProgressState) {
    state = (await transitionState(organization, project, id, inProgressState))
      ? inProgressState
      : state;
  }

  return {
    id,
    title,
    parentId,
    state,
    url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`
  };
}

function readState(created: unknown): string {
  if (created && typeof created === 'object') {
    const fields = (created as { fields?: Record<string, unknown> }).fields;
    const state = fields?.['System.State'];
    if (typeof state === 'string') {
      return state;
    }
  }
  return '';
}

async function transitionState(
  organization: string,
  project: string,
  id: number,
  state: string
): Promise<boolean> {
  try {
    const response = await authFetch(
      `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
        `/_apis/wit/workitems/${id}?api-version=7.0`,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify([
          { op: 'add', path: '/fields/System.State', value: state }
        ])
      }
    );
    if (!response.ok) {
      console.warn(
        `[quickTask] created #${id} but could not set state to "${state}": HTTP ${response.status}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      `[quickTask] created #${id} but the state change threw`,
      error
    );
    return false;
  }
}

/**
 * Moves a finished quick task under the archive work item.
 *
 * The Quick tab lists the children of the quick-task parent, so re-parenting is
 * what "archiving" means here: the task keeps its history and stays findable
 * under the archive item, but stops crowding the day's list. Consolidating many
 * finished tasks under one archive item is the point — the alternative is
 * deleting them or letting the list grow forever.
 */
export async function archiveQuickTask(options: {
  organization: string;
  project: string;
  taskId: number;
  archiveId: number;
}): Promise<void> {
  const { organization, project, taskId, archiveId } = options;

  if (!organization || !project) {
    throw new Error('Missing organization/project context for archiving.');
  }
  if (!Number.isInteger(archiveId) || archiveId <= 0) {
    throw new Error(
      'Set a quick-task archive work item id in Settings before archiving.'
    );
  }

  await reparentWorkItem(organization, project, taskId, archiveId);
}
