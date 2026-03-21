import type { WorkItem } from '@/types';

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
