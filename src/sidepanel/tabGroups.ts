// Open tabs, grouped the way you think about them.
//
// Azure DevOps already groups by the part of it a page belongs to. The same
// shape is useful for anywhere else you keep a lot of tabs — a wiki, an issue
// tracker — so the grouping is a setting: name a domain, and narrow it later
// into sub-domains or paths when one group stops being enough.
//
// A group is a domain first because that is the thing you can name without
// looking anything up. The narrowing comes second, once you have seen what
// lands in it, which is why adding a domain takes no rules at all. Past a bare
// domain the definition is a pattern — see `tabGroupPattern.ts` — so a
// sub-domain and a path, a port, or a local server on http are all one field.

import { patternToUrl, urlMatchesPattern } from './tabGroupPattern';
import {
  unopenedBookmarks,
  type AppBookmark,
  type AppFolder,
  type AppSubGroup
} from './appGroups';
import {
  compareTabsByAgeThenPath,
  readFavIconUrl,
  readTabPath,
  type OpenTab
} from './adoTabs';

export interface GroupedTab {
  id: number;
  title: string;
  url: string;
  path: string;
  lastAccessed: number | null;
  windowId: number | null;
  favIconUrl: string | null;
  pinned: boolean;
  active: boolean;
  audible: boolean;
}

export interface TabGroupNode {
  key: string;
  label: string;
  /** Tabs directly in this group. Empty when the children hold them all. */
  tabs: GroupedTab[];
  children: TabGroupNode[];
  /**
   * Where a new tab for this group would go, when the definition names one
   * place. Absent for the built-in sections and for wildcarded patterns, which
   * describe many addresses and pick none.
   */
  openUrl?: string;
  /**
   * The host this group would be defined as, set only on the sub-groups of
   * **Other**. They are the ones that are not a group yet, and this is what
   * makes one of them permanent.
   */
  promoteDomain?: string;
  /**
   * Bookmarks of this group with nothing open at their address. They are rows
   * too: a definition is not an open tab, and clicking one makes the tab.
   */
  bookmarks?: AppBookmark[];
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function toGroupedTab(tab: OpenTab): GroupedTab | null {
  if (typeof tab.id !== 'number' || tab.url === undefined) {
    return null;
  }
  return {
    id: tab.id,
    title: (tab.title ?? '').trim() || tab.url,
    url: tab.url,
    path: readTabPath(tab.url),
    lastAccessed:
      typeof tab.lastAccessed === 'number' ? tab.lastAccessed : null,
    windowId: typeof tab.windowId === 'number' ? tab.windowId : null,
    favIconUrl: readFavIconUrl(tab),
    pinned: tab.pinned === true,
    active: tab.active === true,
    audible: tab.audible === true
  };
}

export type TabOrder = 'oldest' | 'newest';

/**
 * Every tab in a group, including the ones in its sub-groups.
 *
 * The icon and the count both want the whole group rather than the rows
 * directly under it, which for a narrowed group is nothing at all.
 */
export function allTabsIn(group: TabGroupNode): GroupedTab[] {
  return [...group.tabs, ...group.children.flatMap(allTabsIn)];
}

/**
 * The icon for a group: the one from its newest tab.
 *
 * The newest rather than the first, because the first changes with the sort
 * order and an icon that flips when you reverse the list is telling you about
 * the sort rather than about the group. A tab with no icon is skipped rather
 * than counted as the answer.
 */
export function groupFavIconUrl(group: TabGroupNode): string | null {
  let best: GroupedTab | null = null;

  for (const tab of allTabsIn(group)) {
    if (tab.favIconUrl === null) {
      continue;
    }
    if (
      best === null ||
      (tab.lastAccessed ?? -Infinity) > (best.lastAccessed ?? -Infinity)
    ) {
      best = tab;
    }
  }

  return best?.favIconUrl ?? null;
}

/**
 * The same tree, ordered the other way round when asked.
 *
 * The builders always produce oldest-first, which is the order the list is for;
 * reversing is a view preference and is applied over the top rather than
 * threaded through every builder as a parameter nobody else needs.
 */
export function sortTabGroups(
  groups: TabGroupNode[],
  order: TabOrder
): TabGroupNode[] {
  if (order === 'oldest') {
    return groups;
  }
  return groups.map((group) => ({
    ...group,
    tabs: [...group.tabs].reverse(),
    children: sortTabGroups(group.children, order)
  }));
}

/** The label for the catch-all, and the key its sub-groups hang from. */
export const OTHER_GROUP_KEY = 'other';

/**
 * Everything that landed in no group, by host.
 *
 * A list of what you have open that says nothing about most of it is not a
 * list of what you have open. The host is the grouping because it is the one
 * thing every address has and the one you would name if you were defining a
 * group for it — which is exactly what the sub-groups offer to become.
 *
 * Null when everything is already claimed: an empty catch-all is noise, and
 * unlike a configured group nobody asked for it to be there.
 */
export function buildOtherGroup(
  tabs: OpenTab[],
  claimed: Set<number>
): TabGroupNode | null {
  const rest = tabs
    .map(toGroupedTab)
    .filter((tab): tab is GroupedTab => tab !== null)
    .filter((tab) => !claimed.has(tab.id));

  if (rest.length === 0) {
    return null;
  }

  const byHost = new Map<string, GroupedTab[]>();
  for (const tab of rest) {
    const host = hostOf(tab.url) ?? tab.url;
    byHost.set(host, [...(byHost.get(host) ?? []), tab]);
  }

  return {
    key: OTHER_GROUP_KEY,
    label: 'Other',
    tabs: [],
    children: [...byHost]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([host, hostTabs]) => ({
        key: `${OTHER_GROUP_KEY}:${host}`,
        label: host,
        tabs: [...hostTabs].sort(compareTabsByAgeThenPath),
        children: [],
        promoteDomain: host
      }))
  };
}

/** Every tab id a group and its children hold. */
export function claimedTabIds(groups: TabGroupNode[]): Set<number> {
  const ids = new Set<number>();
  for (const group of groups) {
    for (const tab of allTabsIn(group)) {
      ids.add(tab.id);
    }
  }
  return ids;
}

/**
 * The group keys in the order they should be drawn.
 *
 * A stored order of *every* top-level group, not only the configured ones. The
 * first version of this reordered the settings, which meant dragging an Azure
 * DevOps section or the catch-all did nothing at all — and from the outside
 * that is indistinguishable from dragging being broken. What the user is
 * arranging is the list in front of them, so that is what gets recorded.
 *
 * Keys that are not in the stored order keep their natural position after the
 * ones that are, so a section that appears later is added rather than hidden.
 */
export function applyKeyOrder(
  groups: TabGroupNode[],
  orderedKeys: string[]
): TabGroupNode[] {
  const rank = new Map(orderedKeys.map((key, index) => [key, index]));

  return [...groups]
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const left = rank.get(a.group.key);
      const right = rank.get(b.group.key);
      if (left === undefined && right === undefined) {
        return a.index - b.index;
      }
      if (left === undefined) {
        return 1;
      }
      if (right === undefined) {
        return -1;
      }
      return left - right;
    })
    .map((entry) => entry.group);
}

/**
 * The order left behind by dropping one group into a gap.
 *
 * `index` counts the gaps, not the groups: 0 is before the first, and the last
 * is after the last. Taking the dragged key out before inserting is what makes
 * a drop into the gap just below where it came from a no-op rather than an
 * off-by-one.
 */
export function moveKeyTo(
  keys: string[],
  fromKey: string,
  index: number
): string[] {
  const from = keys.indexOf(fromKey);
  if (from < 0) {
    return keys;
  }

  const without = keys.filter((key) => key !== fromKey);
  const at = Math.max(
    0,
    Math.min(without.length, index > from ? index - 1 : index)
  );
  return [...without.slice(0, at), fromKey, ...without.slice(at)];
}

/**
 * The groups the `Apps` folders describe, filled with what is open.
 *
 * The rule is the folder's name — a host — which is the part of a bookmark that
 * syncs. Every tab on that host belongs to the group, whether or not it is
 * bookmarked; the bookmarks are the few main addresses, and one with nothing
 * open at it stays on the list as a row that opens it.
 *
 * A folder may be `base.com` and another `sub.base.com`, and a tab on the
 * sub-domain answers to both. The longer name wins, so the more specific folder
 * takes it: a group named for a sub-domain exists precisely to separate it out,
 * and having the tab in both would make the counts lie.
 *
 * Flat, because the folders are: how a host's open pages are then arranged is
 * this panel's business rather than something written into somebody's
 * bookmarks and synced to every machine they own.
 */
export function buildAppGroups(
  folders: AppFolder[],
  tabs: OpenTab[]
): TabGroupNode[] {
  const all = tabs
    .map(toGroupedTab)
    .filter((tab): tab is GroupedTab => tab !== null);

  const bestFor = (tab: GroupedTab): AppFolder | null => {
    let best: AppFolder | null = null;
    for (const folder of folders) {
      const pattern = folder.name.trim();
      if (!urlMatchesPattern(tab.url, pattern)) {
        continue;
      }
      if (best === null || pattern.length > best.name.trim().length) {
        best = folder;
      }
    }
    return best;
  };

  return folders.map((folder) => {
    const mine = all
      .filter((tab) => bestFor(tab)?.id === folder.id)
      .sort(compareTabsByAgeThenPath);

    // A sub-group narrows the app to part of itself, and takes its tabs out of
    // the app's own list: a tab counted in both would make both counts wrong.
    // The longest name wins where two could take it, the same rule as between
    // apps, so a narrower sub-group is not swallowed by a wider one.
    const subGroupFor = (tab: GroupedTab): AppSubGroup | null => {
      let best: AppSubGroup | null = null;
      for (const sub of folder.subGroups) {
        const pattern = sub.name.trim();
        if (!urlMatchesPattern(tab.url, pattern)) {
          continue;
        }
        if (best === null || pattern.length > best.name.trim().length) {
          best = sub;
        }
      }
      return best;
    };

    const children = folder.subGroups.map((sub) => {
      const theirs = mine.filter((tab) => subGroupFor(tab)?.id === sub.id);
      return {
        key: `app:${folder.id}:${sub.id}`,
        label: sub.name,
        tabs: theirs,
        children: [],
        bookmarks: unopenedBookmarks(
          sub.bookmarks,
          theirs.map((tab) => tab.url)
        ),
        openUrl: patternToUrl(sub.name.trim()) ?? undefined
      };
    });

    const unclaimed = mine.filter((tab) => subGroupFor(tab) === null);

    return {
      key: `app:${folder.id}`,
      label: folder.name,
      tabs: unclaimed,
      children,
      bookmarks: unopenedBookmarks(
        folder.bookmarks,
        mine.map((tab) => tab.url)
      ),
      openUrl: patternToUrl(folder.name.trim()) ?? undefined
    };
  });
}
