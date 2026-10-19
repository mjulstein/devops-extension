import { useCallback, useEffect, useState } from 'react';
import { readAppFolders, type AppFolder } from './appGroups';
import { findAppsFolder } from './apps/appsFolder';

/**
 * The app folders as the bookmarks currently hold them.
 *
 * Re-read on any bookmark change, because the folders *are* the definition:
 * one added here, in the bookmark manager, or synced in from another machine
 * all arrive the same way and all mean the same thing.
 */
export function useAppFolders(favoritesFolderName: string): AppFolder[] {
  const [folders, setFolders] = useState<AppFolder[]>([]);

  const refresh = useCallback(() => {
    void chrome.bookmarks
      ?.getTree()
      .then((tree) => {
        setFolders(readAppFolders(findAppsFolder(tree, favoritesFolderName)));
      })
      .catch(() => undefined);
  }, [favoritesFolderName]);

  useEffect(() => {
    refresh();

    const events = [
      chrome.bookmarks?.onCreated,
      chrome.bookmarks?.onRemoved,
      chrome.bookmarks?.onChanged,
      chrome.bookmarks?.onMoved,
      chrome.bookmarks?.onChildrenReordered
    ];
    for (const event of events) {
      event?.addListener(refresh);
    }
    return () => {
      for (const event of events) {
        event?.removeListener(refresh);
      }
    };
  }, [refresh]);

  return folders;
}
