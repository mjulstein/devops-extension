import { useEffect, useState } from 'react';
import { loadApps } from './appsFolder';
import { loadSettings } from '../chromeStorage';
import type { AppEntry } from './appDns';

/**
 * The apps as the bookmarks currently hold them.
 *
 * Re-read on any bookmark change, because the folder is the source: an
 * environment added from the palette, moved in the bookmark manager, or synced
 * in from another machine should all show up without reopening the panel. An
 * empty list is a fine answer — it is what no favorites folder, or no apps in
 * it, looks like.
 */
export function useApps(): AppEntry[] {
  const [apps, setApps] = useState<AppEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      void loadSettings()
        .then((settings) => loadApps(settings.bookmarkFolderName))
        .then((next) => {
          if (!cancelled) {
            setApps(next);
          }
        })
        .catch(() => undefined);
    };

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
      cancelled = true;
      for (const event of events) {
        event?.removeListener(refresh);
      }
    };
  }, []);

  return apps;
}
