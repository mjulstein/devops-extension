// The chrome.bookmarks calls the manager page makes, in one place.
//
// Keeping them here rather than in components means the components deal in the
// tree shape from `bookmarksModel` and nothing else, and the page can be reasoned
// about without the browser API in the way.

import type { BookmarkNode } from './bookmarksModel';

type ChangeListener = () => void;

export async function readTree(): Promise<BookmarkNode[]> {
  const roots = await chrome.bookmarks.getTree();
  // The single unnamed root is an implementation detail of the API; what the
  // user thinks of as the top level is its children.
  return roots[0]?.children ?? [];
}

export async function moveInto(id: string, parentId: string): Promise<void> {
  await chrome.bookmarks.move(id, { parentId });
}

export async function removeNode(id: string, isFolder: boolean): Promise<void> {
  // removeTree on a bookmark is an error, and remove on a non-empty folder is
  // too, so the caller's knowledge of which it is has to be carried through.
  if (isFolder) {
    await chrome.bookmarks.removeTree(id);
  } else {
    await chrome.bookmarks.remove(id);
  }
}

export async function updateNode(
  id: string,
  changes: { title?: string; url?: string }
): Promise<void> {
  await chrome.bookmarks.update(id, changes);
}

export async function createFolder(
  parentId: string,
  title: string
): Promise<void> {
  await chrome.bookmarks.create({ parentId, title });
}

/**
 * Calls back on any bookmark change, including ones made in another window.
 *
 * The page holds the tree in state, so an edit made in the browser's own manager
 * or synced in from another machine would otherwise leave it showing a tree that
 * no longer exists. Every event reloads the whole tree: the tree is small, and
 * patching it by event type is a second model to keep correct.
 */
export function subscribeToBookmarkChanges(
  listener: ChangeListener
): () => void {
  const events = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered
  ].filter(Boolean);

  const handler = () => {
    listener();
  };
  for (const event of events) {
    event?.addListener(handler);
  }
  return () => {
    for (const event of events) {
      event?.removeListener(handler);
    }
  };
}
