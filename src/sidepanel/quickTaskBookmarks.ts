// Quick tasks mirrored into a bookmarks sub-folder.
//
// A quick task is a small job you are in the middle of, and the browser's own
// bookmark sync is what carries it to the other machine — the same trick the
// favorites folder uses, applied to work rather than to places.
//
// Only tasks actually in progress are listed. The folder is meant to answer
// "what am I in the middle of", so a task that is finished, cancelled, or no
// longer returned at all has its bookmark deleted rather than kept as a record:
// the list is a working set, not a history.

import type { WorkItem } from '@/types';
import type { StarredPage } from './starredPages';
import { isStartedState } from './work-items/atoms/workItemGrouping';
import {
  findOrCreateChildFolder,
  findOrCreateFolderByName,
  type BookmarkNode
} from './bookmarkSync';

/** Sub-folder of the configured favorites folder that holds the tasks. */
export const QUICK_TASK_BOOKMARK_FOLDER = 'Quick tasks';

export interface QuickTaskBookmarkPlan {
  create: { url: string; title: string }[];
  update: { id: string; title: string }[];
  remove: string[];
}

export interface QuickTaskBookmarkRequest {
  /** Quick tasks as last fetched, in any state. */
  tasks: WorkItem[];
  /** What the sub-folder currently holds. */
  bookmarks: BookmarkNode[];
}

/**
 * What the folder should become.
 *
 * Keyed on the task's url, which is stable across renames — so a renamed task
 * keeps its bookmark and has its title corrected, rather than losing the
 * bookmark and gaining a new one.
 */
export function planQuickTaskBookmarks({
  tasks,
  bookmarks
}: QuickTaskBookmarkRequest): QuickTaskBookmarkPlan {
  const plan: QuickTaskBookmarkPlan = { create: [], update: [], remove: [] };

  const wanted = new Map<string, string>();
  for (const task of tasks) {
    if (task.url && isStartedState(task.state)) {
      wanted.set(task.url, buildBookmarkTitle(task));
    }
  }

  const seen = new Set<string>();
  for (const node of bookmarks) {
    // Folders, and anything else without an address, are someone else's.
    if (!node.url) {
      continue;
    }

    const title = wanted.get(node.url);
    if (title === undefined || seen.has(node.url)) {
      // Finished, no longer listed, or a duplicate the browser's sync produced.
      plan.remove.push(node.id);
      continue;
    }

    seen.add(node.url);
    if ((node.title ?? '') !== title) {
      plan.update.push({ id: node.id, title });
    }
  }

  for (const [url, title] of wanted) {
    if (!seen.has(url)) {
      plan.create.push({ url, title });
    }
  }

  return plan;
}

/**
 * The bookmark's name. The task's own title carries the meaning, and the id is
 * what lets you recognise it in an address bar full of similar work.
 */
export function buildBookmarkTitle(task: WorkItem): string {
  const title = task.title.replace(/\s+/g, ' ').trim();
  return title ? `#${task.id} ${title}` : `#${task.id}`;
}

export function isQuickTaskBookmarkPlanEmpty(
  plan: QuickTaskBookmarkPlan
): boolean {
  return (
    plan.create.length === 0 &&
    plan.update.length === 0 &&
    plan.remove.length === 0
  );
}

export type QuickTaskBookmarkSyncResult =
  | { ok: true; plan: QuickTaskBookmarkPlan }
  | { ok: false; error: string };

/**
 * Applies the plan to the sub-folder, creating it under the favorites folder if
 * it is not there yet.
 */
export async function syncQuickTaskBookmarks(
  folderName: string,
  tasks: WorkItem[]
): Promise<QuickTaskBookmarkSyncResult> {
  const name = folderName.trim();
  if (!name) {
    return { ok: false, error: 'No bookmarks folder name is set.' };
  }
  if (!chrome.bookmarks?.getTree) {
    return { ok: false, error: 'The bookmarks permission is not granted.' };
  }

  try {
    const parent = await findOrCreateFolderByName(name);
    if ('error' in parent) {
      return { ok: false, error: parent.error };
    }

    const folder = await findOrCreateChildFolder(
      parent.id,
      QUICK_TASK_BOOKMARK_FOLDER
    );
    if ('error' in folder) {
      return { ok: false, error: folder.error };
    }

    const children = await chrome.bookmarks.getChildren(folder.id);
    const plan = planQuickTaskBookmarks({ tasks, bookmarks: children });

    for (const id of plan.remove) {
      await chrome.bookmarks.remove(id).catch(() => undefined);
    }
    for (const entry of plan.update) {
      await chrome.bookmarks
        .update(entry.id, { title: entry.title })
        .catch(() => undefined);
    }
    for (const entry of plan.create) {
      await chrome.bookmarks
        .create({ parentId: folder.id, title: entry.title, url: entry.url })
        .catch(() => undefined);
    }

    return { ok: true, plan };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/** One line for the debug console, or null when nothing needed doing. */
export function describeQuickTaskBookmarkSync(
  plan: QuickTaskBookmarkPlan
): string | null {
  if (isQuickTaskBookmarkPlanEmpty(plan)) {
    return null;
  }
  const parts: string[] = [];
  if (plan.create.length > 0) parts.push(`added ${plan.create.length}`);
  if (plan.update.length > 0) parts.push(`renamed ${plan.update.length}`);
  if (plan.remove.length > 0) parts.push(`removed ${plan.remove.length}`);
  return `Quick task bookmarks: ${parts.join(', ')}.`;
}

/**
 * The in-progress tasks as entries the favorites list can render.
 *
 * Shaped like a favorite so both surfaces reuse one row: they are, after all,
 * the same gesture — somewhere you want to get to in one keystroke. They are
 * kept in their own list rather than merged in, because a favorite is something
 * you chose and a quick task is something that happens to be open, and the
 * listing sorts them accordingly.
 */
export function buildQuickTaskLinks(tasks: WorkItem[]): StarredPage[] {
  return tasks
    .filter((task) => task.url && isStartedState(task.state))
    .map((task) => ({
      url: task.url,
      label: buildBookmarkTitle(task),
      starredAt: 0
    }));
}
