import { normalizePageUrl, type StarredPage } from './starredPages';
import type { FoldedBookmark } from './favoritesListing';

// Keeps starred pages and a browser bookmarks folder in step, so favorites also
// surface in omnibox autocomplete and — the reason this is two-way — travel
// between machines over the browser's own bookmark sync.
//
// The folder is the shared store, because it is the half that syncs. Local
// favorites are a cache of it. The panel is only ever *ahead* of the folder for
// a favorite it just added and has not written yet; for everything else the
// folder wins, so a rename or delete that arrives from another machine is
// adopted rather than overwritten.
//
// Telling "added here, not yet pushed" apart from "deleted over there" needs
// memory of what the folder last looked like: that is the baseline.

export interface BookmarkNode {
  id: string;
  title?: string;
  url?: string;
}

export interface BookmarkSyncPlan {
  create: { title: string; url: string }[];
  update: { id: string; title: string; url: string }[];
  remove: string[];
}

/**
 * Works out the minimum set of bookmark operations to make `folder` match
 * `favorites`.
 *
 * Matching is by URL, because that is a favorite's identity — a renamed
 * favorite should be retitled in place rather than removed and recreated, which
 * would lose its position and creation date.
 */
export function planBookmarkSync(
  folder: BookmarkNode[],
  favorites: StarredPage[]
): BookmarkSyncPlan {
  const plan: BookmarkSyncPlan = { create: [], update: [], remove: [] };

  const byUrl = new Map<string, BookmarkNode>();
  for (const node of folder) {
    // Folders inside our folder have no url; leave them alone rather than
    // deleting something the user put there deliberately.
    if (typeof node.url !== 'string' || !node.url) {
      continue;
    }
    const existing = byUrl.get(node.url);
    if (existing) {
      // A duplicate of a url we already matched is redundant.
      plan.remove.push(node.id);
      continue;
    }
    byUrl.set(node.url, node);
  }

  const wanted = new Set<string>();

  for (const favorite of favorites) {
    wanted.add(favorite.url);
    const node = byUrl.get(favorite.url);
    if (!node) {
      plan.create.push({ title: favorite.label, url: favorite.url });
      continue;
    }
    if (node.title !== favorite.label) {
      plan.update.push({
        id: node.id,
        title: favorite.label,
        url: favorite.url
      });
    }
  }

  for (const [url, node] of byUrl) {
    if (!wanted.has(url)) {
      plan.remove.push(node.id);
    }
  }

  return plan;
}

export function isBookmarkSyncPlanEmpty(plan: BookmarkSyncPlan): boolean {
  return (
    plan.create.length === 0 &&
    plan.update.length === 0 &&
    plan.remove.length === 0
  );
}

/**
 * What the folder looked like the last time the two sides were reconciled, as
 * normalised url -> bookmark title.
 *
 * Without it, "this favorite has no bookmark" is ambiguous: it could be a star
 * added here a moment ago, or one another machine deleted. The baseline settles
 * it — a url we have seen in the folder before and that is now gone was deleted
 * remotely.
 */
export type BookmarkBaseline = Record<string, string>;

export interface ReconcileRequest {
  /** Current children of the folder. */
  bookmarks: BookmarkNode[];
  /** Favorites held locally. */
  favorites: StarredPage[];
  baseline: BookmarkBaseline;
  /** Timestamp given to favorites adopted from the folder. */
  now: number;
  /**
   * Urls the user just unstarred here. Without this an unstar would be
   * indistinguishable from a favorite we have never had, and the still-present
   * bookmark would be adopted straight back.
   */
  removedLocally?: string[];
}

export interface ReconcileResult {
  /** Favorites after the merge. */
  favorites: StarredPage[];
  /** Writes needed to bring the folder in line. */
  plan: BookmarkSyncPlan;
  /** Baseline to store once the plan has been applied. */
  baseline: BookmarkBaseline;
  /** Urls taken from the folder because it had them and we did not. */
  adopted: string[];
  /** Urls dropped because the folder no longer has a bookmark we had seen. */
  droppedRemotely: string[];
  /** Urls whose label the folder renamed. */
  renamedRemotely: string[];
}

/**
 * Merges the folder and local favorites under one rule: the folder wins, except
 * for a favorite the panel has added and not yet written.
 *
 * Pure so the merge rules can be tested without a browser; the caller applies
 * `plan` and stores `favorites` and `baseline`.
 */
export function reconcileFavoritesWithBookmarks({
  bookmarks,
  favorites,
  baseline,
  now,
  removedLocally = []
}: ReconcileRequest): ReconcileResult {
  const plan: BookmarkSyncPlan = { create: [], update: [], remove: [] };
  const adopted: string[] = [];
  const droppedRemotely: string[] = [];
  const renamedRemotely: string[] = [];

  // Bookmarks keyed by the same identity favorites use, so a bookmark saved
  // with a trailing slash or a #fragment still matches its favorite.
  const nodesByUrl = new Map<string, { node: BookmarkNode; url: string }>();
  for (const node of bookmarks) {
    // Sub-folders have no url. Someone put them there on purpose; leave them.
    if (typeof node.url !== 'string' || !node.url) {
      continue;
    }
    const url = normalizePageUrl(node.url);
    if (url === null) {
      continue;
    }
    if (nodesByUrl.has(url)) {
      // Two bookmarks for one page, which sync duplicates can produce.
      plan.remove.push(node.id);
      continue;
    }
    nodesByUrl.set(url, { node, url });
  }

  const favoritesByUrl = new Map(favorites.map((page) => [page.url, page]));
  const removed = new Set(removedLocally);
  const nextFavorites: StarredPage[] = [];
  const nextBaseline: BookmarkBaseline = {};

  for (const favorite of favorites) {
    const match = nodesByUrl.get(favorite.url);

    if (!match) {
      if (Object.hasOwn(baseline, favorite.url)) {
        // Seen in the folder before, gone now: deleted on another machine.
        droppedRemotely.push(favorite.url);
        continue;
      }
      // Added here and never written: the one case where the panel is ahead.
      plan.create.push({ title: favorite.label, url: favorite.url });
      nextFavorites.push(favorite);
      nextBaseline[favorite.url] = favorite.label;
      continue;
    }

    const bookmarkTitle = match.node.title ?? '';

    if (bookmarkTitle === favorite.label) {
      nextFavorites.push(favorite);
      nextBaseline[favorite.url] = favorite.label;
      continue;
    }

    if (baseline[favorite.url] !== bookmarkTitle) {
      // The folder's title moved away from what we last saw: a remote rename.
      renamedRemotely.push(favorite.url);
      nextFavorites.push({ ...favorite, label: bookmarkTitle });
      nextBaseline[favorite.url] = bookmarkTitle;
      continue;
    }

    // The folder still holds the old title, so the rename happened here.
    plan.update.push({
      id: match.node.id,
      title: favorite.label,
      url: match.node.url ?? favorite.url
    });
    nextFavorites.push(favorite);
    nextBaseline[favorite.url] = favorite.label;
  }

  // Anything in the folder we do not have is a favorite from another machine.
  for (const [url, { node }] of nodesByUrl) {
    if (favoritesByUrl.has(url)) {
      continue;
    }
    if (removed.has(url)) {
      // Unstarred here a moment ago: delete the bookmark rather than adopt it.
      plan.remove.push(node.id);
      continue;
    }
    const label = node.title ?? url;
    adopted.push(url);
    nextFavorites.push({ url, label, starredAt: now });
    nextBaseline[url] = label;
  }

  return {
    favorites: nextFavorites,
    plan,
    baseline: nextBaseline,
    adopted,
    droppedRemotely,
    renamedRemotely
  };
}

export interface BookmarkTreeNode extends BookmarkNode {
  children?: BookmarkTreeNode[];
}

/**
 * Folder ids that a new folder could be created under, best first.
 *
 * Root folder ids are NOT stable across browsers — "2" is Other Bookmarks in
 * Chrome but Edge numbers its roots differently, and hardcoding it made the
 * mirror fail with a useless error there. So the roots are discovered from the
 * tree and tried in turn. Later roots come first because the bar is usually
 * first and a tool-managed folder does not belong on the bar.
 */
export function collectFolderParentCandidates(
  tree: BookmarkTreeNode[]
): string[] {
  const roots = tree[0]?.children ?? tree;
  return roots
    .filter((node) => !node.url && node.id)
    .map((node) => node.id)
    .reverse();
}

/** Finds a folder with this name anywhere in the tree. */
export function findFolderByName(
  tree: BookmarkTreeNode[],
  folderName: string
): string | null {
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (!node.url && node.title === folderName && node.id) {
      return node.id;
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return null;
}

export type BookmarkSyncResult =
  | { ok: true; plan: BookmarkSyncPlan }
  | { ok: false; error: string };

export async function findOrCreateFolderByName(
  folderName: string
): Promise<{ id: string } | { error: string }> {
  const tree = await chrome.bookmarks.getTree();

  // Reuse the folder if it already exists, wherever the user has moved it to.
  const existing = findFolderByName(tree, folderName);
  if (existing) {
    return { id: existing };
  }

  const candidates = collectFolderParentCandidates(tree);
  if (candidates.length === 0) {
    return { error: 'No writable bookmarks folder was found.' };
  }

  const failures: string[] = [];
  for (const parentId of candidates) {
    try {
      const created = await chrome.bookmarks.create({
        parentId,
        title: folderName
      });
      return { id: created.id };
    } catch (error) {
      failures.push(
        `${parentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    error: `Could not create the folder in any root (${failures.join('; ')}).`
  };
}

export interface ReconcileFolderRequest {
  folderName: string;
  favorites: StarredPage[];
  baseline: BookmarkBaseline;
  removedLocally?: string[];
  now?: number;
}

export type ReconcileFolderResult =
  | ({ ok: true; folderId: string } & ReconcileResult)
  | { ok: false; error: string };

/**
 * Reconciles the folder with local favorites and applies the result.
 *
 * Best-effort on the write side: favorites must keep working when the bookmarks
 * permission is missing or one operation fails, so failures to write a single
 * bookmark do not fail the merge.
 */
export async function reconcileBookmarkFolder({
  folderName,
  favorites,
  baseline,
  removedLocally = [],
  now = Date.now()
}: ReconcileFolderRequest): Promise<ReconcileFolderResult> {
  const name = folderName.trim();
  if (!name) {
    return { ok: false, error: 'No folder name is set.' };
  }
  if (!chrome.bookmarks?.getTree) {
    return {
      ok: false,
      error:
        'The bookmarks permission is not granted. Reload the extension on chrome://extensions and accept it.'
    };
  }

  try {
    const folder = await findOrCreateFolderByName(name);
    if ('error' in folder) {
      return { ok: false, error: folder.error };
    }
    const folderId = folder.id;

    const children = await chrome.bookmarks.getChildren(folderId);
    const result = reconcileFavoritesWithBookmarks({
      bookmarks: children,
      favorites,
      baseline,
      now,
      removedLocally
    });

    for (const id of result.plan.remove) {
      await chrome.bookmarks.remove(id).catch(() => undefined);
    }
    for (const entry of result.plan.update) {
      await chrome.bookmarks
        .update(entry.id, { title: entry.title })
        .catch(() => undefined);
    }
    for (const entry of result.plan.create) {
      await chrome.bookmarks
        .create({ parentId: folderId, title: entry.title, url: entry.url })
        .catch(() => undefined);
    }

    return { ok: true, folderId, ...result };
  } catch (error) {
    // Surface the browser's own message: "cannot write to it" with no reason is
    // exactly what made this undiagnosable.
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/** Human-readable summary of what a reconcile did, for the Settings status line. */
export function describeReconcile(
  folderName: string,
  result: ReconcileResult
): string {
  const parts: string[] = [];
  if (result.adopted.length > 0) {
    parts.push(`adopted ${result.adopted.length} from the folder`);
  }
  if (result.renamedRemotely.length > 0) {
    parts.push(`renamed ${result.renamedRemotely.length} from the folder`);
  }
  if (result.droppedRemotely.length > 0) {
    parts.push(`dropped ${result.droppedRemotely.length} deleted elsewhere`);
  }
  if (result.plan.create.length > 0) {
    parts.push(`wrote ${result.plan.create.length} new bookmark(s)`);
  }
  if (result.plan.update.length > 0) {
    parts.push(`retitled ${result.plan.update.length} bookmark(s)`);
  }
  if (result.plan.remove.length > 0) {
    parts.push(`removed ${result.plan.remove.length} bookmark(s)`);
  }

  if (parts.length === 0) {
    return `“${folderName}” is in sync with ${result.favorites.length} favorite(s).`;
  }

  return `“${folderName}”: ${parts.join(', ')}.`;
}

/**
 * A folder with this title directly under `parentId`, created if absent.
 *
 * Scoped to one parent rather than searched for by name across the tree: a
 * sub-folder's name is only meaningful inside its parent, and "Quick tasks"
 * elsewhere in someone's bookmarks is not ours to write into.
 */
export async function findOrCreateChildFolder(
  parentId: string,
  title: string
): Promise<{ id: string } | { error: string }> {
  try {
    const children = await chrome.bookmarks.getChildren(parentId);
    const existing = children.find(
      (node) => !node.url && node.title === title && node.id
    );
    if (existing) {
      return { id: existing.id };
    }

    const created = await chrome.bookmarks.create({ parentId, title });
    return { id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Every bookmark matching a term, with the folder each one lives in.
 *
 * Folders are dropped — there is nowhere to go — and the result is capped,
 * because a two-letter term against a large collection returns more rows than
 * anyone reads and the menu has to stay responsive while typing. The folder name
 * comes along because in a collection that size it is most of what tells two
 * similar titles apart.
 */
export async function searchAllBookmarks(
  term: string,
  limit = 40
): Promise<FoldedBookmark[]> {
  if (!chrome.bookmarks?.search) {
    return [];
  }

  const matches = await chrome.bookmarks.search(term);
  const seen = new Set<string>();
  const kept: { url: string; title: string; parentId?: string }[] = [];

  for (const node of matches) {
    if (!node.url || seen.has(node.url)) {
      continue;
    }
    seen.add(node.url);
    kept.push({
      url: node.url,
      title: node.title || node.url,
      parentId: node.parentId
    });
    if (kept.length >= limit) {
      break;
    }
  }

  const folders = await readFolderTitles(kept);

  return kept.map((entry) => ({
    page: { url: entry.url, label: entry.title, starredAt: 0 },
    folder: entry.parentId ? (folders.get(entry.parentId) ?? '') : ''
  }));
}

/** Parent titles, fetched once per folder rather than once per bookmark. */
async function readFolderTitles(
  entries: { parentId?: string }[]
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const parentIds = [
    ...new Set(entries.map((entry) => entry.parentId).filter(Boolean))
  ] as string[];

  for (const parentId of parentIds) {
    try {
      const [node] = await chrome.bookmarks.get(parentId);
      if (node?.title) {
        titles.set(parentId, node.title);
      }
    } catch {
      // A parent that cannot be read simply leaves the bookmark ungrouped.
    }
  }

  return titles;
}
