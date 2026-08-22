import type { WorkItem, WorkItemParentSummary } from '@/types';

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
