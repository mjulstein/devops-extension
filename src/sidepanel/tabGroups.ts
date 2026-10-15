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
    const rules = setting.rules.filter((rule) => rule.match.trim() !== '');

    if (rules.length === 0) {
      return { key, label, tabs: mine, children: [] };
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
      children: children.filter((child) => child.tabs.length > 0)
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
