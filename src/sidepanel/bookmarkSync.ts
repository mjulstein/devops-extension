import type { StarredPage } from './starredPages';

// Mirrors starred pages into a browser bookmarks folder, so they also surface in
// ordinary omnibox autocomplete and bookmark search without opening the panel.
//
// The panel's favorites are the source of truth; the folder is a projection of
// them. Edits made directly in the bookmark manager are therefore overwritten on
// the next sync — one owner avoids two-way merge problems that would otherwise
// need conflict rules nobody wants.

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

async function findOrCreateFolder(
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

/**
 * Applies the projection. Best-effort: favorites must keep working even when the
 * bookmarks permission is absent or a single operation fails.
 */
export async function syncFavoritesToBookmarks(
  folderName: string,
  favorites: StarredPage[]
): Promise<BookmarkSyncResult> {
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
    const folder = await findOrCreateFolder(name);
    if ('error' in folder) {
      return { ok: false, error: folder.error };
    }
    const folderId = folder.id;

    const children = await chrome.bookmarks.getChildren(folderId);
    const plan = planBookmarkSync(children, favorites);

    for (const id of plan.remove) {
      await chrome.bookmarks.remove(id).catch(() => undefined);
    }
    for (const entry of plan.update) {
      await chrome.bookmarks
        .update(entry.id, { title: entry.title, url: entry.url })
        .catch(() => undefined);
    }
    for (const entry of plan.create) {
      await chrome.bookmarks
        .create({ parentId: folderId, title: entry.title, url: entry.url })
        .catch(() => undefined);
    }

    return { ok: true, plan };
  } catch (error) {
    // Surface the browser's own message: "cannot write to it" with no reason is
    // exactly what made this undiagnosable.
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
