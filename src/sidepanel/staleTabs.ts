// Closing tabs nobody has looked at in a long time.
//
// The companion to deduplicating: duplicates are the same page twice, stale
// tabs are the pages you meant to come back to and did not. Both are the same
// job — a tab strip you can read again — which is why they share a button.
//
// It is deliberately cautious about what counts. Closing a tab someone wanted
// is a worse outcome than leaving one they did not, so anything that looks like
// it is still in use is left alone, and a tab whose age cannot be established
// is never closed on a guess.

/** How long a tab goes untouched before it is offered up. */
export const STALE_TAB_DAYS = 24;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StaleTabCandidate {
  id?: number;
  lastAccessed?: number;
  pinned?: boolean;
  active?: boolean;
  audible?: boolean;
}

/**
 * The tabs old enough to close, oldest first.
 *
 * Pinned tabs are kept because pinning is the act of saying "keep this".
 * Active tabs are kept because one of them is on screen in its window.
 * Audible tabs are kept because something is playing in them. A tab with no
 * `lastAccessed` is kept too: the browser is not saying it is old, it is saying
 * it does not know, and those are different.
 */
export function selectStaleTabs(
  tabs: StaleTabCandidate[],
  now: number,
  maxAgeDays: number = STALE_TAB_DAYS
): number[] {
  const cutoff = now - maxAgeDays * DAY_MS;

  return tabs
    .filter(
      (tab) =>
        typeof tab.id === 'number' &&
        typeof tab.lastAccessed === 'number' &&
        tab.lastAccessed < cutoff &&
        tab.pinned !== true &&
        tab.active !== true &&
        tab.audible !== true
    )
    .sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0))
    .map((tab) => tab.id!);
}

/** How old the oldest of them is, in whole days, for saying what will go. */
export function describeStaleTabs(
  tabs: StaleTabCandidate[],
  ids: number[],
  now: number
): string {
  if (ids.length === 0) {
    return `No tabs have gone ${STALE_TAB_DAYS} days untouched.`;
  }
  const oldest = tabs
    .filter((tab) => typeof tab.id === 'number' && ids.includes(tab.id))
    .reduce(
      (youngest, tab) => Math.min(youngest, tab.lastAccessed ?? now),
      now
    );
  const days = Math.floor((now - oldest) / DAY_MS);
  return `Close ${ids.length} tab${ids.length === 1 ? '' : 's'} untouched for ${STALE_TAB_DAYS} days or more? The oldest is ${days} days old.`;
}

/** Finds and closes them, returning how many went. */
export async function closeStaleTabs(
  confirm: (message: string) => boolean,
  now: number = Date.now()
): Promise<number> {
  const tabs = await chrome.tabs.query({});
  const ids = selectStaleTabs(tabs, now);
  if (ids.length === 0 || !confirm(describeStaleTabs(tabs, ids, now))) {
    return 0;
  }
  await chrome.tabs.remove(ids);
  return ids.length;
}
