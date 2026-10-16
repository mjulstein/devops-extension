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

import type { TabGroupRule, TabGroupSetting } from '@/types';
import { patternToUrl, urlMatchesPattern } from './tabGroupPattern';
import {
  compareTabsByAgeThenPath,
  readFavIconUrl,
  readTabPath,
  type OpenTab
} from './adoTabs';

// A rule's `match` is tested against the address's host and path together, so
// one field covers both a sub-domain (`wiki.example.com`) and a path
// (`/spaces/`) without asking which kind it is. The first rule that matches
// wins.
export type { TabGroupRule, TabGroupSetting } from '@/types';

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

/** What a rule is tested against: the host and path as one string. */
export function matchTarget(url: string): string {
  const host = hostOf(url);
  return host === null
    ? url.toLowerCase()
    : `${host}${readTabPath(url)}`.toLowerCase();
}

function matchingRule(rules: TabGroupRule[], url: string): TabGroupRule | null {
  const target = matchTarget(url);
  return (
    rules.find((rule) => {
      const needle = rule.match.trim().toLowerCase();
      return needle !== '' && target.includes(needle);
    }) ?? null
  );
}

/**
 * One group per configured domain, narrowed by its own rules.
 *
 * A group with no rules holds its tabs directly: that is what a domain looks
 * like before anyone has needed to split it. With rules, the tabs sit in the
 * sub-group that matched first, and whatever matched nothing lands in "Other"
 * — dropping it would make the group quietly lie about what is open.
 *
 * A group with nothing open stays on the list. It is somewhere you said you go,
 * and an empty one is exactly when you want the button that opens the first tab.
 */
export function buildTabGroups(
  tabs: OpenTab[],
  settings: TabGroupSetting[]
): TabGroupNode[] {
  return settings.map((setting, index) => {
    const mine = tabs
      .map(toGroupedTab)
      .filter((tab): tab is GroupedTab => tab !== null)
      .filter((tab) => urlMatchesPattern(tab.url, setting.domain))
      .sort(compareTabsByAgeThenPath);

    const key = `${setting.domain}:${index}`;
    const label = setting.label.trim() || setting.domain;
    const openUrl = patternToUrl(setting.domain) ?? undefined;
    const rules = setting.rules.filter((rule) => rule.match.trim() !== '');

    if (rules.length === 0) {
      return { key, label, tabs: mine, children: [], openUrl };
    }

    const children: TabGroupNode[] = rules.map((rule, ruleIndex) => ({
      key: `${key}:${ruleIndex}`,
      label: rule.label.trim() || rule.match,
      tabs: mine.filter((tab) => matchingRule(rules, tab.url) === rule),
      children: []
    }));

    const rest = mine.filter((tab) => matchingRule(rules, tab.url) === null);
    if (rest.length > 0) {
      children.push({
        key: `${key}:other`,
        label: 'Other',
        tabs: rest,
        children: []
      });
    }

    return {
      key,
      label,
      tabs: [],
      children: children.filter((child) => child.tabs.length > 0),
      openUrl
    };
  });
  // Nothing is filtered out: a group you defined stays on the list with
  // nothing in it, because an empty one is still somewhere you meant to go and
  // is where you open the first tab from.
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

/** A new group for a domain, before anyone has narrowed it. */
export function createTabGroup(domain: string): TabGroupSetting {
  const trimmed = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '');
  const host = trimmed.split('/')[0].replace(/^\.+/, '');
  return { domain: host, label: host, rules: [] };
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
