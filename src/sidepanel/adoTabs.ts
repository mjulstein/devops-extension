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
  return groups.map((group) => ({
    key: `ado:${group.section}`,
    label: group.label,
    tabs: group.tabs,
    children: []
  }));
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
      windowId: typeof tab.windowId === 'number' ? tab.windowId : null
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
