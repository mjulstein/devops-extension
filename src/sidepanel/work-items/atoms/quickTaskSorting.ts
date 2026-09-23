import type { WorkItem } from '@/types';

// Ordering for the Quick tasks list:
//   1. pinned tasks, in the order they were pinned
//   2. everything still open, most recently touched first
//   3. finished tasks, at the bottom
//
// Finished tasks stay in the list rather than disappearing — the point of the
// tab is the day's small jobs, and seeing what is already done is part of that —
// but they must never push open work off the top.

const DONE_STATES = new Set(['done', 'closed', 'removed']);

export function isFinishedState(state: string): boolean {
  return DONE_STATES.has(state.trim().toLowerCase());
}

function changedAt(item: WorkItem): number {
  const parsed = item.lastChangedDate
    ? Date.parse(item.lastChangedDate)
    : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortQuickTasks(
  items: WorkItem[],
  pinnedIds: number[]
): WorkItem[] {
  const pinnedOrder = new Map(pinnedIds.map((id, index) => [id, index]));

  const pinned: WorkItem[] = [];
  const open: WorkItem[] = [];
  const finished: WorkItem[] = [];

  for (const item of items) {
    if (pinnedOrder.has(item.id)) {
      pinned.push(item);
    } else if (isFinishedState(item.state)) {
      finished.push(item);
    } else {
      open.push(item);
    }
  }

  // A pin is an explicit ordering choice, so it wins over recency — and over
  // being finished, so a pinned task you are done with does not jump away.
  pinned.sort(
    (a, b) => (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0)
  );

  const byRecency = (a: WorkItem, b: WorkItem) =>
    changedAt(b) - changedAt(a) || b.id - a.id;
  open.sort(byRecency);
  finished.sort(byRecency);

  return [...pinned, ...open, ...finished];
}

/** Toggles a pin, appending so the newest pin sits last among pinned items. */
export function togglePinnedId(pinnedIds: number[], id: number): number[] {
  return pinnedIds.includes(id)
    ? pinnedIds.filter((pinned) => pinned !== id)
    : [...pinnedIds, id];
}
