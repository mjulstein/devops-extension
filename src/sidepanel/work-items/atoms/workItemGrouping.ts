import type { WorkItem, WorkItemParentSummary } from '@/types';
import { getTaskStateTone } from '@/sidepanel/taskStateDisplay';

export interface ClosedItemGroup {
  key: string;
  label: string;
  items: WorkItem[];
}

export function groupClosedItems(items: WorkItem[]): ClosedItemGroup[] {
  const groups: ClosedItemGroup[] = [];
  const byKey = new Map<string, ClosedItemGroup>();

  for (const item of items) {
    const group = getClosedGroup(item.closedDate);
    const existing = byKey.get(group.key);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    const next = {
      ...group,
      items: [item]
    };
    byKey.set(group.key, next);
    groups.push(next);
  }

  return groups;
}

export function getClosedGroup(value: string | null): {
  key: string;
  label: string;
} {
  if (!value) {
    return {
      key: 'unknown',
      label: 'Unknown date'
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      key: value,
      label: value
    };
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    label: date.toLocaleDateString()
  };
}

export function shouldEmphasizeCompletedItem(item: WorkItem): boolean {
  if (!item.closedDate) {
    return false;
  }

  const normalizedType = item.workItemType.trim().toLowerCase();
  return (
    normalizedType === 'bug' ||
    normalizedType === 'pbi' ||
    normalizedType === 'improvement' ||
    normalizedType === 'product backlog item'
  );
}

export interface ParentGroup {
  key: string;
  parent: WorkItemParentSummary | null;
  items: WorkItem[];
}

const NO_PARENT_KEY = 'no-parent';

/**
 * Groups items under their parent, preserving the order the items arrived in:
 * a parent first appears where its first item did, so the sort applied upstream
 * still governs what you see at the top.
 *
 * Items with no parent collect into a single trailing group with `parent: null`
 * — they are usually the deliverables themselves (a Bug or PBI), so they belong
 * in the list rather than hidden.
 */
export function groupItemsByParent(items: WorkItem[]): ParentGroup[] {
  const groups: ParentGroup[] = [];
  const byKey = new Map<string, ParentGroup>();

  for (const item of items) {
    const key = item.parent ? `parent-${item.parent.id}` : NO_PARENT_KEY;
    const existing = byKey.get(key);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    const group: ParentGroup = {
      key,
      parent: item.parent,
      items: [item]
    };
    byKey.set(key, group);
    groups.push(group);
  }

  // Parentless items read as a footnote to the grouped work, not a lead-in.
  const parentless = groups.findIndex((group) => group.key === NO_PARENT_KEY);
  if (parentless >= 0 && parentless !== groups.length - 1) {
    const [group] = groups.splice(parentless, 1);
    groups.push(group);
  }

  return groups;
}

/**
 * Drops parent rows whose work has already started.
 *
 * In the flat TODO list a parent and its tasks both appear when both are
 * assigned to you, and the parent row then says nothing the started task does
 * not. A task in progress is the thing that needs focus and will finish first,
 * so it stands in for its parent. A parent with nothing started keeps its row,
 * because then it is the row carrying the context.
 *
 * Only parents present in the list are considered, and only their children that
 * are also present: a task whose parent is not listed is never affected, and
 * nothing outside a parent/child pair in this list is removed.
 */
export function omitParentsWithStartedTasks(items: WorkItem[]): WorkItem[] {
  const startedParentIds = new Set<number>();

  for (const item of items) {
    if (item.parentId !== null && isStartedState(item.state)) {
      startedParentIds.add(item.parentId);
    }
  }

  if (startedParentIds.size === 0) {
    return items;
  }

  return items.filter((item) => !startedParentIds.has(item.id));
}

/**
 * Whether a state means the work is under way, as opposed to merely queued.
 *
 * Deliberately narrower than "not done": a parent is only redundant once
 * something under it is actually being worked on.
 */
export function isStartedState(state: string): boolean {
  return getTaskStateTone(state) === 'in-progress';
}

export interface ActivitySplit {
  /** Items being worked on, which belong in the main list. */
  active: WorkItem[];
  /** Everything still queued, which belongs behind an accordion. */
  idle: WorkItem[];
}

/**
 * Splits a list into what is under way and what is merely queued.
 *
 * The Authored list is long and mostly dormant — items you filed for someone
 * else that nobody has picked up. Keeping the dormant ones out of the main list
 * makes the few that are actually moving visible, without losing the rest.
 */
export function splitByActivity(items: WorkItem[]): ActivitySplit {
  const active: WorkItem[] = [];
  const idle: WorkItem[] = [];

  for (const item of items) {
    (isStartedState(item.state) ? active : idle).push(item);
  }

  return { active, idle };
}
