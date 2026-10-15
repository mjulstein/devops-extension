import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  groupAdoTabs,
  readAdoTabs,
  toTabGroupNodes,
  type OpenTab
} from './adoTabs';
import {
  buildOtherGroup,
  buildTabGroups,
  claimedTabIds,
  type TabGroupNode,
  type TabGroupSetting
} from './tabGroups';

/**
 * The open tabs worth grouping, kept current.
 *
 * Re-read on every tab event rather than patched: the list is short, and
 * keeping a second model of the browser's tabs correct through creates, moves,
 * navigations and closes is more to go wrong than simply asking again.
 */
export function useTabGroups(groupSettings: TabGroupSetting[]): {
  groups: TabGroupNode[];
  refresh: () => void;
} {
  const [tabs, setTabs] = useState<OpenTab[]>([]);

  const refresh = useCallback(() => {
    void chrome.tabs
      ?.query({})
      .then(setTabs)
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

  // Azure DevOps's sections first, then the configured domains, all at the same
  // level: by the time you are looking at this you are asking what you have
  // open, not what kind of thing it is.
  const groups = useMemo(() => {
    const defined = [
      ...toTabGroupNodes(groupAdoTabs(readAdoTabs(tabs))),
      ...buildTabGroups(tabs, groupSettings)
    ];
    // Last, and only when it holds something: everything that landed nowhere,
    // by host, each one a group waiting to be made permanent.
    const other = buildOtherGroup(tabs, claimedTabIds(defined));
    return other === null ? defined : [...defined, other];
  }, [groupSettings, tabs]);

  return { groups, refresh };
}
