import type { WorkItem } from '@/types';
import {
  getClosedGroup,
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
