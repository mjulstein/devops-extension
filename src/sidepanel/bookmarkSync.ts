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

/** "Other bookmarks" — where a tool-managed folder belongs, not the bar. */
const OTHER_BOOKMARKS_ID = '2';

async function findOrCreateFolder(folderName: string): Promise<string | null> {
  if (!chrome.bookmarks?.getChildren) {
    return null;
  }
  const children = await chrome.bookmarks.getChildren(OTHER_BOOKMARKS_ID);
  const existing = children.find(
    (child) => !child.url && child.title === folderName
  );
  if (existing) {
    return existing.id;
  }
  const created = await chrome.bookmarks.create({
    parentId: OTHER_BOOKMARKS_ID,
    title: folderName
  });
  return created.id;
}

/**
 * Applies the projection. Best-effort: favorites must keep working even when the
 * bookmarks permission is absent or a single operation fails.
 */
export async function syncFavoritesToBookmarks(
  folderName: string,
  favorites: StarredPage[]
): Promise<BookmarkSyncPlan | null> {
  const name = folderName.trim();
  if (!name) {
    return null;
  }
  if (!chrome.bookmarks?.getChildren) {
    console.warn(
      '[bookmarkSync] chrome.bookmarks unavailable — the "bookmarks" permission may be missing.'
    );
    return null;
  }

  try {
    const folderId = await findOrCreateFolder(name);
    if (!folderId) {
      return null;
    }

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

    return plan;
  } catch (error) {
    console.warn('[bookmarkSync] sync failed', error);
    return null;
  }
}
