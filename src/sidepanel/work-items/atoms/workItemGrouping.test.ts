import type { WorkItem } from '@/types';
import {
  getClosedGroup,
  groupItemsByParent,
  groupClosedItems,
  shouldEmphasizeCompletedItem
} from './workItemGrouping';

function createWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 1,
    workItemType: 'Bug',
    title: 'Example item',
    state: 'Done',
    assignedTo: 'Test User',
    parentId: null,
    parent: null,
    closedDate: '2026-03-20T12:00:00.000Z',
    lastChangedDate: '2026-03-19T12:00:00.000Z',
    url: 'https://example.test/work-item/1',
    ...overrides
  };
}

describe('workItemGrouping', () => {
  it('groups closed items by calendar day key', () => {
    const groups = groupClosedItems([
      createWorkItem({ id: 1, closedDate: '2026-03-20T09:00:00.000Z' }),
      createWorkItem({ id: 2, closedDate: '2026-03-20T17:30:00.000Z' }),
      createWorkItem({ id: 3, closedDate: '2026-03-19T13:00:00.000Z' })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: '2026-03-20'
    });
    expect(groups[0]?.items.map((item) => item.id)).toEqual([1, 2]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual([3]);
  });

  it('returns fallback labels for unknown or invalid closed dates', () => {
    expect(getClosedGroup(null)).toEqual({
      key: 'unknown',
      label: 'Unknown date'
    });
    expect(getClosedGroup('not-a-date')).toEqual({
      key: 'not-a-date',
      label: 'not-a-date'
    });
  });

  it('emphasizes completed parentable item types only when closed', () => {
    expect(
      shouldEmphasizeCompletedItem(createWorkItem({ workItemType: 'Bug' }))
    ).toBe(true);
    expect(
      shouldEmphasizeCompletedItem(
        createWorkItem({
          workItemType: 'Task',
          closedDate: '2026-03-20T12:00:00.000Z'
        })
      )
    ).toBe(false);
    expect(
      shouldEmphasizeCompletedItem(
        createWorkItem({ workItemType: 'PBI', closedDate: null })
      )
    ).toBe(false);
  });
});

describe('groupItemsByParent', () => {
  function parent(id: number) {
    return {
      id,
      title: `Parent ${id}`,
      workItemType: 'Product Backlog Item',
      url: `https://example.invalid/${id}`
    };
  }

  function item(id: number, parentId: number | null): WorkItem {
    return {
      id,
      workItemType: 'Task',
      title: `Task ${id}`,
      state: 'To Do',
      assignedTo: 'Dev',
      parentId,
      parent: parentId === null ? null : parent(parentId),
      closedDate: null,
      lastChangedDate: null,
      url: `https://example.invalid/${id}`
    };
  }

  it('collects items under a shared parent', () => {
    const groups = groupItemsByParent([
      item(1, 900),
      item(2, 900),
      item(3, 901)
    ]);

    expect(groups.map((g) => g.key)).toEqual(['parent-900', 'parent-901']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 2]);
    expect(groups[1]?.items.map((i) => i.id)).toEqual([3]);
  });

  // Upstream sorting must survive grouping, so a parent appears where its
  // first item did.
  it('orders parents by first appearance', () => {
    const groups = groupItemsByParent([
      item(1, 901),
      item(2, 900),
      item(3, 901)
    ]);

    expect(groups.map((g) => g.key)).toEqual(['parent-901', 'parent-900']);
  });

  it('puts parentless items in a single trailing group', () => {
    const groups = groupItemsByParent([
      item(1, null),
      item(2, 900),
      item(3, null)
    ]);

    expect(groups.map((g) => g.key)).toEqual(['parent-900', 'no-parent']);
    expect(groups[1]?.parent).toBeNull();
    expect(groups[1]?.items.map((i) => i.id)).toEqual([1, 3]);
  });

  it('returns nothing for an empty list', () => {
    expect(groupItemsByParent([])).toEqual([]);
  });
});
