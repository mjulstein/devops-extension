import type { WorkItem } from '@/types';
import {
  getClosedGroup,
  groupItemsByParent,
  groupClosedItems,
  isStartedState,
  omitParentsWithStartedTasks,
  splitByActivity,
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

describe('omitParentsWithStartedTasks', () => {
  function parent(id: number, state = 'To Do'): WorkItem {
    return createWorkItem({
      id,
      workItemType: 'Improvement',
      title: `Parent ${id}`,
      state,
      parentId: null,
      closedDate: null
    });
  }

  function task(id: number, parentId: number, state: string): WorkItem {
    return createWorkItem({
      id,
      workItemType: 'Task',
      title: `Task ${id}`,
      state,
      parentId,
      closedDate: null
    });
  }

  function idsOf(items: WorkItem[]): number[] {
    return items.map((item) => item.id);
  }

  it('drops a parent once one of its tasks is in progress', () => {
    const items = [parent(10), task(11, 10, 'In Progress')];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([11]);
  });

  it('keeps a parent whose tasks have not been started', () => {
    const items = [parent(10), task(11, 10, 'To Do'), task(12, 10, 'New')];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([10, 11, 12]);
  });

  it('keeps the queued siblings of a started task', () => {
    // The parent goes because work has started; the sibling is still a separate
    // thing assigned to me and must not vanish with it.
    const items = [
      parent(10),
      task(11, 10, 'In Progress'),
      task(12, 10, 'To Do')
    ];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([11, 12]);
  });

  it('leaves a task alone when its parent is not in the list', () => {
    const items = [task(11, 99, 'In Progress'), task(12, 99, 'To Do')];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([11, 12]);
  });

  it('never touches an item that is nobody’s parent', () => {
    const items = [
      createWorkItem({ id: 20, workItemType: 'Bug', state: 'In Progress' }),
      createWorkItem({ id: 21, workItemType: 'Bug', state: 'To Do' })
    ];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([20, 21]);
  });

  it('judges each parent on its own tasks', () => {
    const items = [
      parent(10),
      task(11, 10, 'In Progress'),
      parent(20),
      task(21, 20, 'To Do')
    ];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([11, 20, 21]);
  });

  it('preserves the incoming order of what it keeps', () => {
    const items = [
      task(21, 20, 'To Do'),
      parent(10),
      task(11, 10, 'Active'),
      parent(20)
    ];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([21, 11, 20]);
  });

  it('returns the same list untouched when nothing has started', () => {
    const items = [parent(10), task(11, 10, 'To Do')];

    expect(omitParentsWithStartedTasks(items)).toBe(items);
  });

  it('drops a grandparent only when its own child has started', () => {
    // A started grandchild says nothing about the grandparent's direct child,
    // which may still be the row carrying the context.
    const items = [
      parent(10),
      createWorkItem({
        id: 20,
        workItemType: 'Improvement',
        state: 'To Do',
        parentId: 10,
        closedDate: null
      }),
      task(30, 20, 'In Progress')
    ];

    expect(idsOf(omitParentsWithStartedTasks(items))).toEqual([10, 30]);
  });
});

describe('isStartedState', () => {
  it('counts the states that mean work is under way', () => {
    expect(isStartedState('In Progress')).toBe(true);
    expect(isStartedState('Active')).toBe(true);
    expect(isStartedState('Committed')).toBe(true);
  });

  it('does not count queued or finished states', () => {
    expect(isStartedState('To Do')).toBe(false);
    expect(isStartedState('New')).toBe(false);
    expect(isStartedState('Done')).toBe(false);
    expect(isStartedState('Closed')).toBe(false);
  });
});

describe('splitByActivity', () => {
  function item(id: number, state: string): WorkItem {
    return createWorkItem({ id, state, closedDate: null });
  }

  it('puts started items in the main list and the rest behind the accordion', () => {
    const split = splitByActivity([
      item(1, 'In Progress'),
      item(2, 'To Do'),
      item(3, 'Active'),
      item(4, 'New')
    ]);

    expect(split.active.map((entry) => entry.id)).toEqual([1, 3]);
    expect(split.idle.map((entry) => entry.id)).toEqual([2, 4]);
  });

  it('keeps the incoming order within each half', () => {
    const split = splitByActivity([
      item(9, 'To Do'),
      item(8, 'In Progress'),
      item(7, 'To Do')
    ]);

    expect(split.idle.map((entry) => entry.id)).toEqual([9, 7]);
    expect(split.active.map((entry) => entry.id)).toEqual([8]);
  });

  it('copes with a list that is entirely one or the other', () => {
    expect(splitByActivity([item(1, 'To Do')]).active).toEqual([]);
    expect(splitByActivity([item(1, 'Active')]).idle).toEqual([]);
    expect(splitByActivity([])).toEqual({ active: [], idle: [] });
  });
});
