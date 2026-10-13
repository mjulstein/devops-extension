import { useCallback, useEffect, useState } from 'react';
import { groupAdoTabs, readAdoTabs, type AdoTabGroup } from './adoTabs';

/**
 * The open Azure DevOps tabs, kept current.
 *
 * Re-read on every tab event rather than patched: the list is short, and
 * keeping a second model of the browser's tabs correct through creates, moves,
 * navigations and closes is more to go wrong than simply asking again.
 */
export function useAdoTabs(): {
  groups: AdoTabGroup[];
  refresh: () => void;
} {
  const [groups, setGroups] = useState<AdoTabGroup[]>([]);

  const refresh = useCallback(() => {
    void chrome.tabs
      ?.query({})
      .then((tabs) => {
        setGroups(groupAdoTabs(readAdoTabs(tabs)));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();

    const events = [
      chrome.tabs?.onCreated,
      chrome.tabs?.onRemoved,
      chrome.tabs?.onUpdated,
      chrome.tabs?.onActivated,
      chrome.tabs?.onMoved
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

  return { groups, refresh };
}
