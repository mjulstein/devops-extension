// The Azure DevOps tabs you have open, grouped by the part of it they belong to.
//
// It sits beside the stale-tab threshold because it answers the same question
// from the other end: that one offers to close what you have forgotten, this
// one shows you what is actually open so you can close it yourself or go back
// to it. A count is not enough — which boards and which repos is the thing you
// need to see before deciding.
//
// Oldest first, because the ones you have not touched are the ones worth a
// decision; within the same age, by address, so the same repo's tabs sit
// together rather than wherever the browser happened to put them.

import type { TabGroupNode } from './tabGroups';
import {
  adoSectionOf,
  SECTION_LABELS,
  type DevOpsSection
} from '@/devops/sectionIcons';

export interface OpenTab {
  id?: number;
  title?: string;
  url?: string;
  lastAccessed?: number;
  windowId?: number;
  favIconUrl?: string;
  pinned?: boolean;
  active?: boolean;
  audible?: boolean;
}

export interface AdoTab {
  id: number;
  title: string;
  url: string;
  /** The path and query, which is what tells two tabs of a section apart. */
  path: string;
  section: DevOpsSection;
  lastAccessed: number | null;
  windowId: number | null;
  /**
   * The tab's own icon. On Azure DevOps this is the section icon, because the
   * content script is what put it there — so a group's icon says which part of
   * Azure DevOps it is without this having to look one up.
   */
  favIconUrl: string | null;
  /**
   * Carried so a cleanup scoped to one section keeps the protections the
   * stale-tab list has: a pinned, active or audible tab is in use.
   */
  pinned: boolean;
  active: boolean;
  audible: boolean;
}

export interface AdoTabGroup {
  section: DevOpsSection;
  label: string;
  tabs: AdoTab[];
}

/**
 * The Azure DevOps sections as the shared group shape.
 *
 * Its sections sit at the top level beside the configured domains rather than
 * under a heading of their own: Azure DevOps is not one group with parts, it is
 * the parts.
 */
export function toTabGroupNodes(groups: AdoTabGroup[]): TabGroupNode[] {
  return groups.map((group) => {
    const key = `ado:${group.section}`;

    // Repos is the one section where the part you care about is in the address
    // rather than in the section: five tabs across three repositories is three
    // things, not five. Every other section is a list of pages of one kind.
    if (group.section !== 'repos') {
      return { key, label: group.label, tabs: group.tabs, children: [] };
    }

    const byRepo = new Map<string, AdoTab[]>();
    const loose: AdoTab[] = [];

    for (const tab of group.tabs) {
      const repo = repoNameOf(tab.url);
      if (repo === null) {
        loose.push(tab);
        continue;
      }
      byRepo.set(repo, [...(byRepo.get(repo) ?? []), tab]);
    }

    const children: TabGroupNode[] = [...byRepo]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([repo, tabs]) => ({
        key: `${key}:${repo}`,
        label: repo,
        tabs,
        children: []
      }));

    if (loose.length > 0) {
      children.push({
        key: `${key}:other`,
        label: 'Other',
        tabs: loose,
        children: []
      });
    }

    return { key, label: group.label, tabs: [], children };
  });
}

/**
 * The repository an address belongs to: the segment after `_git`.
 *
 * Null for anything that does not name one — the repos landing page, and the
 * legacy `_versioncontrol` paths, which have no repository in them to find.
 */
export function repoNameOf(url: string): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }

  const segments = path.split('/').filter(Boolean);
  const at = segments.findIndex((segment) => segment.toLowerCase() === '_git');
  if (at < 0 || at + 1 >= segments.length) {
    return null;
  }
  try {
    return decodeURIComponent(segments[at + 1]);
  } catch {
    return segments[at + 1];
  }
}

/**
 * A tab's icon, if it has one worth drawing.
 *
 * A blank or non-http address is treated as none: an <img> pointed at nothing
 * draws a broken-image glyph, which is worse than the space it would fill.
 */
export function readFavIconUrl(tab: { favIconUrl?: string }): string | null {
  const url = (tab.favIconUrl ?? '').trim();
  return url !== '' && /^(https?|data):/i.test(url) ? url : null;
}

/** The path and query of an address, which is what tells two tabs apart. */
export function readTabPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** The Azure DevOps tabs among these, with what the grouping needs. */
export function readAdoTabs(tabs: OpenTab[]): AdoTab[] {
  const found: AdoTab[] = [];

  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || tab.url === undefined) {
      continue;
    }
    const section = adoSectionOf(tab.url);
    if (section === null) {
      continue;
    }
    found.push({
      id: tab.id,
      title: (tab.title ?? '').trim() || tab.url,
      url: tab.url,
      path: readTabPath(tab.url),
      section,
      lastAccessed:
        typeof tab.lastAccessed === 'number' ? tab.lastAccessed : null,
      windowId: typeof tab.windowId === 'number' ? tab.windowId : null,
      favIconUrl: readFavIconUrl(tab),
      pinned: tab.pinned === true,
      active: tab.active === true,
      audible: tab.audible === true
    });
  }

  return found;
}

/**
 * Grouped by section, in Azure DevOps's own nav order.
 *
 * Sections with nothing open are left out rather than shown empty: the list is
 * what you have, not what you could have. A tab whose age the browser does not
 * report sorts last within its group — not knowing how old it is is not the
 * same as it being old, which is the rule the stale-tab list uses too.
 */
export function groupAdoTabs(tabs: AdoTab[]): AdoTabGroup[] {
  const order = Object.keys(SECTION_LABELS) as DevOpsSection[];

  return order
    .map((section) => ({
      section,
      label: SECTION_LABELS[section],
      tabs: tabs
        .filter((tab) => tab.section === section)
        .sort(compareTabsByAgeThenPath)
    }))
    .filter((group) => group.tabs.length > 0);
}

/**
 * Oldest first, then by address.
 *
 * Shared with the configured groups so every tab list in the panel is ordered
 * the same way, including the rule that an unknown age sorts last.
 */
export function compareTabsByAgeThenPath(
  a: { lastAccessed: number | null; path: string },
  b: { lastAccessed: number | null; path: string }
): number {
  if (a.lastAccessed !== b.lastAccessed) {
    if (a.lastAccessed === null) {
      return 1;
    }
    if (b.lastAccessed === null) {
      return -1;
    }
    return a.lastAccessed - b.lastAccessed;
  }
  return a.path.localeCompare(b.path);
}

/** How long ago a tab was looked at, for the row to say. */
export function describeTabAge(
  tab: { lastAccessed: number | null },
  now: number = Date.now()
): string {
  if (tab.lastAccessed === null) {
    return 'never opened in this session';
  }
  const days = Math.floor((now - tab.lastAccessed) / (24 * 60 * 60 * 1000));
  if (days >= 1) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor((now - tab.lastAccessed) / (60 * 60 * 1000));
  return hours >= 1 ? `${hours}h ago` : 'just now';
}
