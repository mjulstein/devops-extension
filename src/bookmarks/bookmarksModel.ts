// The bookmark tree as the manager page reasons about it.
//
// Everything here is pure: it takes the tree the browser hands back and answers
// questions about it. The chrome.bookmarks calls that act on those answers live
// in `bookmarksApi.ts`, so the rules below can be tested without a browser.

export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  children?: BookmarkNode[];
}

export interface BookmarkEntry {
  id: string;
  title: string;
  url: string;
  parentId: string;
  /** Ancestor folder titles, so a row can say where it lives. */
  folderPath: string;
}

export interface FolderEntry {
  id: string;
  title: string;
  path: string;
  /** Direct children of any kind; zero is what makes a folder empty. */
  childCount: number;
}

export interface DuplicateGroup {
  /** What the members share: a title, or a url without its search params. */
  key: string;
  entries: BookmarkEntry[];
}

function isFolder(node: BookmarkNode): boolean {
  return node.url === undefined;
}

/** Every bookmark in the tree, each carrying the folder path above it. */
export function flattenBookmarks(tree: BookmarkNode[]): BookmarkEntry[] {
  const entries: BookmarkEntry[] = [];

  function walk(nodes: BookmarkNode[], ancestors: string[]): void {
    for (const node of nodes) {
      if (node.url) {
        entries.push({
          id: node.id,
          title: node.title,
          url: node.url,
          parentId: node.parentId ?? '',
          folderPath: ancestors.join(' / ')
        });
        continue;
      }
      walk(
        node.children ?? [],
        node.title ? [...ancestors, node.title] : ancestors
      );
    }
  }

  walk(tree, []);
  return entries;
}

/** Every folder in the tree, with how many children it directly holds. */
export function collectFolders(tree: BookmarkNode[]): FolderEntry[] {
  const folders: FolderEntry[] = [];

  function walk(nodes: BookmarkNode[], ancestors: string[]): void {
    for (const node of nodes) {
      if (!isFolder(node)) {
        continue;
      }
      folders.push({
        id: node.id,
        title: node.title,
        path: ancestors.join(' / '),
        childCount: (node.children ?? []).length
      });
      walk(
        node.children ?? [],
        node.title ? [...ancestors, node.title] : ancestors
      );
    }
  }

  walk(tree, []);
  return folders;
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * A url stripped of its search params and hash.
 *
 * Two entries that differ only by a query string are, for a bookmark list, the
 * same destination saved twice — the second one is a tracking parameter or a
 * stale view state, not a different page worth its own row.
 */
export function urlWithoutSearch(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.origin}${path}`.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function group(
  entries: BookmarkEntry[],
  keyOf: (entry: BookmarkEntry) => string
): Map<string, BookmarkEntry[]> {
  const groups = new Map<string, BookmarkEntry[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (!key) {
      continue;
    }
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return groups;
}

/** Bookmarks sharing a title, wherever they live. */
export function duplicateNameGroups(
  entries: BookmarkEntry[]
): DuplicateGroup[] {
  return [...group(entries, (entry) => normalizeTitle(entry.title))]
    .filter(([, members]) => members.length > 1)
    .map(([key, members]) => ({ key, entries: members }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Bookmarks pointing at the same page from different folders.
 *
 * Two copies inside one folder are a list that needs tidying, which the main
 * area already shows side by side; the interesting case is the same page filed
 * twice in two places, where neither copy is visible from the other.
 */
export function duplicatePathGroups(
  entries: BookmarkEntry[]
): DuplicateGroup[] {
  return [...group(entries, (entry) => urlWithoutSearch(entry.url))]
    .filter(([, members]) => {
      if (members.length < 2) {
        return false;
      }
      return new Set(members.map((entry) => entry.parentId)).size > 1;
    })
    .map(([key, members]) => ({ key, entries: members }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Folders holding nothing at all.
 *
 * A folder whose only children are themselves empty folders still counts as
 * holding something: deleting the parent would take the children with it, and
 * that is a bigger decision than the one this list offers.
 */
export function emptyFolders(tree: BookmarkNode[]): FolderEntry[] {
  return collectFolders(tree).filter((folder) => folder.childCount === 0);
}

export interface FolderGroup {
  /** The shared name. */
  key: string;
  folders: FolderEntry[];
}

/**
 * Folders sharing a name, wherever they sit.
 *
 * Two folders called the same thing are the reason a bookmark ends up in the
 * wrong one, and unlike a duplicated bookmark the fix is usually a rename rather
 * than a delete — so this list offers renaming and nothing else.
 */
export function duplicateFolderNameGroups(tree: BookmarkNode[]): FolderGroup[] {
  const groups = new Map<string, FolderEntry[]>();
  for (const folder of collectFolders(tree)) {
    const key = normalizeTitle(folder.title);
    if (!key) {
      continue;
    }
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(folder);
    } else {
      groups.set(key, [folder]);
    }
  }

  return [...groups]
    .filter(([, members]) => members.length > 1)
    .map(([key, folders]) => ({ key, folders }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Case-insensitive match on title, url, and the folder path around it. */
export function filterEntries(
  entries: BookmarkEntry[],
  term: string
): BookmarkEntry[] {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return entries;
  }
  return entries.filter((entry) =>
    `${entry.title} ${entry.url} ${entry.folderPath}`
      .toLowerCase()
      .includes(needle)
  );
}

export function filterFolders(
  folders: FolderEntry[],
  term: string
): FolderEntry[] {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return folders;
  }
  return folders.filter((folder) =>
    `${folder.title} ${folder.path}`.toLowerCase().includes(needle)
  );
}

export function filterGroups(
  groups: DuplicateGroup[],
  term: string
): DuplicateGroup[] {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return groups;
  }
  return groups
    .map((entry) => ({
      key: entry.key,
      entries: filterEntries(entry.entries, needle)
    }))
    .filter((entry) => entry.entries.length > 0);
}

export function filterFolderGroups(
  groups: FolderGroup[],
  term: string
): FolderGroup[] {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return groups;
  }
  return groups
    .map((group) => ({
      key: group.key,
      folders: filterFolders(group.folders, needle)
    }))
    .filter((group) => group.folders.length > 0);
}

export function findNode(
  tree: BookmarkNode[],
  id: string
): BookmarkNode | null {
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return null;
}

/**
 * Whether a drag may land where it was dropped.
 *
 * Dropping a folder into itself or into one of its own descendants would cut
 * that subtree out of the tree entirely, and the browser reports it as an
 * opaque error rather than refusing it usefully, so the rule is enforced here
 * before the move is attempted. A bookmark already in the target folder is
 * refused too: the move would be a no-op dressed up as an action.
 */
export function canDropInto(
  tree: BookmarkNode[],
  dragId: string,
  targetFolderId: string
): boolean {
  if (!dragId || !targetFolderId || dragId === targetFolderId) {
    return false;
  }
  const dragged = findNode(tree, dragId);
  const target = findNode(tree, targetFolderId);
  if (!dragged || !target || !isFolder(target)) {
    return false;
  }
  if (dragged.parentId === targetFolderId) {
    return false;
  }
  return (
    !isFolder(dragged) ||
    findNode(dragged.children ?? [], targetFolderId) === null
  );
}
