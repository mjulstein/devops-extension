// Rearranging the tab bar itself, rather than the list of it.
//
// The Tabs tab groups what is open so you can read it. These commands do the
// same to the strip along the top, where the browser leaves tabs wherever they
// happened to be opened: tabs of one app end up scattered between unrelated
// ones, and no amount of listing them elsewhere fixes the row you actually
// click in.

import { adoSectionOf } from '@/devops/sectionIcons';
import type { AppFolder } from './appGroups';
import type { OpenTab } from './adoTabs';

/**
 * Which group a tab belongs to, as one comparable string.
 *
 * The app folders first, longest name winning so a sub-domain's own folder
 * takes it; then Azure DevOps's sections, which are groups without being
 * folders; then the host, so anything ungrouped still sits with its own kind
 * rather than being scattered through everything else.
 */
export function groupKeyOf(url: string, folders: AppFolder[]): string {
  let best = '';
  for (const folder of folders) {
    const name = folder.name.trim().toLowerCase();
    if (name === '' || name.length <= best.length) {
      continue;
    }
    const host = hostOf(url);
    if (host !== null && (host === name || host.endsWith(`.${name}`))) {
      best = name;
    }
  }
  if (best !== '') {
    return `app:${best}`;
  }

  const section = adoSectionOf(url);
  if (section !== null) {
    return `ado:${section}`;
  }
  return `host:${hostOf(url) ?? ''}`;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export interface TabMove {
  id: number;
  index: number;
}

/**
 * Where each tab should sit so its group is contiguous.
 *
 * Per window, because a tab cannot be moved to an index in a window it is not
 * in. Groups keep the order they first appear in, and tabs keep their order
 * within a group: sorting should gather, not shuffle — anyone who has arranged
 * two tabs side by side should find them side by side afterwards.
 *
 * Pinned tabs are left where they are. The browser keeps them at the front and
 * moving one out of that run is an error, not a rearrangement.
 */
export function planGroupedTabOrder(
  tabs: (OpenTab & { index?: number })[],
  folders: AppFolder[]
): TabMove[] {
  const byWindow = new Map<number, (OpenTab & { index?: number })[]>();
  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || tab.url === undefined) {
      continue;
    }
    const windowId = tab.windowId ?? -1;
    byWindow.set(windowId, [...(byWindow.get(windowId) ?? []), tab]);
  }

  const moves: TabMove[] = [];

  for (const windowTabs of byWindow.values()) {
    const ordered = [...windowTabs].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0)
    );
    const movable = ordered.filter((tab) => tab.pinned !== true);
    const firstIndex = movable.length === 0 ? 0 : (movable[0].index ?? 0);

    const groups: string[] = [];
    const members = new Map<string, number[]>();

    for (const tab of movable) {
      const key = groupKeyOf(tab.url ?? '', folders);
      if (!members.has(key)) {
        members.set(key, []);
        groups.push(key);
      }
      members.get(key)?.push(tab.id!);
    }

    let at = firstIndex;
    for (const key of groups) {
      for (const id of members.get(key) ?? []) {
        moves.push({ id, index: at });
        at += 1;
      }
    }
  }

  return moves;
}
