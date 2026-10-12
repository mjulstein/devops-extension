// Work items you have looked at lately, and finding one again by number.
//
// The number is how work items are spoken about — in a standup, in a commit
// message, in a link someone pasted — so typing one should be enough to get
// there. It is also the one thing about a work item you can know without having
// fetched anything, which is why `#12345` opens straight away rather than
// waiting to confirm the item exists.
//
// The list behind it is a recently-visited trace, kept browser-locally: it is
// about this machine's browsing, and syncing it would say nothing useful on
// another one. It holds no credentials and no organization name of its own —
// the addresses it stores are the ones already in the browser's history.

export interface RecentWorkItem {
  id: number;
  /** The tab's title when it was visited, which is the readable part. */
  title: string;
  url: string;
  at: number;
}

export const RECENT_WORK_ITEMS_KEY = 'recentWorkItems';

/** How many to remember. Long enough to cover a day's work, short enough to read. */
export const RECENT_WORK_ITEM_LIMIT = 25;

/**
 * The list with this item at the front.
 *
 * Keyed on the id, so revisiting an item moves it up rather than repeating it,
 * and a title that has since changed is corrected. An item visited without a
 * usable title keeps the one it already had: an empty heading is worse than a
 * stale one.
 */
export function recordRecentWorkItem(
  list: RecentWorkItem[],
  entry: RecentWorkItem,
  limit = RECENT_WORK_ITEM_LIMIT
): RecentWorkItem[] {
  const previous = list.find((item) => item.id === entry.id);
  const merged: RecentWorkItem = {
    ...entry,
    title: entry.title.trim() || (previous?.title ?? '')
  };

  return [merged, ...list.filter((item) => item.id !== entry.id)].slice(
    0,
    limit
  );
}

export interface WorkItemQuery {
  /** The number typed, when what was typed is a number. */
  id: number | null;
  /** What to match titles against. */
  filter: string;
}

/**
 * Reads what was typed after the `#`.
 *
 * A number is both: it opens that item outright *and* narrows the list, because
 * the number you half-remember is as likely to be in the list as it is to be
 * the one you want. Anything else only narrows.
 */
export function parseWorkItemQuery(term: string): WorkItemQuery {
  const trimmed = term.trim();
  return {
    id: /^\d+$/.test(trimmed) ? Number(trimmed) : null,
    filter: trimmed
  };
}

/** Recently visited items matching what was typed, newest first. */
export function matchRecentWorkItems(
  list: RecentWorkItem[],
  filter: string
): RecentWorkItem[] {
  const needle = filter.trim().toLowerCase();
  if (needle === '') {
    return list;
  }
  return list.filter(
    (item) =>
      String(item.id).includes(needle) ||
      item.title.toLowerCase().includes(needle)
  );
}

/**
 * The address of a work item.
 *
 * The organization and project are passed in, never assumed: they are the
 * user's own and are resolved at runtime from settings or from the last Azure
 * DevOps page visited.
 */
export function buildWorkItemUrl(
  organization: string,
  project: string,
  id: number
): string | null {
  if (!organization.trim() || !project.trim() || !Number.isFinite(id)) {
    return null;
  }
  return `https://dev.azure.com/${encodeURIComponent(
    organization.trim()
  )}/${encodeURIComponent(project.trim())}/_workitems/edit/${id}`;
}
