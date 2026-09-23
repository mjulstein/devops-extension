// Bookmark folders, for browsing rather than searching.
//
// A widened search with nothing typed has no useful answer in bookmarks — it is
// every bookmark you own. The folders are the useful answer: they are how you
// already organise them, and picking one is how you get to a short list worth
// reading. Typing then matches folder names as well as bookmark titles, so a
// remembered folder name brings its whole contents along.

export interface BookmarkFolderNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkFolderNode[];
}

export interface BookmarkFolder {
  id: string;
  title: string;
  /** Ancestors above it, so two folders with one name can be told apart. */
  path: string;
  /** Bookmarks directly inside, which is what makes a row worth picking. */
  count: number;
}

/**
 * Every named folder that holds at least one bookmark.
 *
 * Empty folders are left out: a row that leads to nothing is a dead end, and the
 * roots themselves ("Bookmarks bar" and friends) are kept because that is where
 * loose bookmarks live.
 */
export function collectBookmarkFolders(
  tree: BookmarkFolderNode[]
): BookmarkFolder[] {
  const folders: BookmarkFolder[] = [];

  function walk(nodes: BookmarkFolderNode[], ancestors: string[]): void {
    for (const node of nodes) {
      if (node.url || !node.children) {
        continue;
      }
      const count = node.children.filter((child) => child.url).length;
      if (node.title && count > 0) {
        folders.push({
          id: node.id,
          title: node.title,
          path: ancestors.join(' / '),
          count
        });
      }
      walk(node.children, node.title ? [...ancestors, node.title] : ancestors);
    }
  }

  walk(tree, []);
  return folders;
}

/** Folders whose name contains the term; everything when nothing is typed. */
export function matchBookmarkFolders(
  folders: BookmarkFolder[],
  term: string
): BookmarkFolder[] {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return folders;
  }
  return folders.filter((folder) =>
    folder.title.toLowerCase().includes(needle)
  );
}

/** The bookmarks directly inside a folder. */
export function bookmarksInFolder(
  tree: BookmarkFolderNode[],
  folderId: string
): { url: string; title: string; folder: string }[] {
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (node.id === folderId && node.children) {
      return node.children
        .filter((child) => child.url)
        .map((child) => ({
          url: child.url ?? '',
          title: child.title || (child.url ?? ''),
          folder: node.title
        }));
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return [];
}
