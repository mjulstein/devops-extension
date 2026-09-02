import type { WorkItem } from '@/types';
import {
  isFinishedState,
  sortQuickTasks,
  togglePinnedId
} from './quickTaskSorting';

function task(id: number, state: string, changedDay: number): WorkItem {
  return {
    id,
    workItemType: 'Task',
    title: `Task ${id}`,
    state,
    assignedTo: 'Dev',
    parentId: 1000,
    parent: null,
    closedDate: null,
    lastChangedDate: `2026-08-${String(changedDay).padStart(2, '0')}T10:00:00.000Z`,
    url: `https://example.invalid/${id}`
  };
}

describe('isFinishedState', () => {
  it('treats done, closed and removed as finished', () => {
    for (const state of ['Done', 'closed', ' Removed ']) {
      expect(isFinishedState(state)).toBe(true);
    }
  });

  it('treats to do and in progress as open', () => {
    expect(isFinishedState('To Do')).toBe(false);
    expect(isFinishedState('In Progress')).toBe(false);
  });
});

describe('sortQuickTasks', () => {
  it('orders open tasks most recently changed first', () => {
    const result = sortQuickTasks(
      [task(1, 'To Do', 10), task(2, 'In Progress', 20), task(3, 'To Do', 15)],
      []
    );
    expect(result.map((t) => t.id)).toEqual([2, 3, 1]);
  });

  // Not-in-progress tasks belong in this list too, unlike TODO.
  it('keeps To Do tasks alongside In Progress ones', () => {
    const result = sortQuickTasks([task(1, 'To Do', 10)], []);
    expect(result.map((t) => t.id)).toEqual([1]);
  });

  it('pushes finished tasks to the bottom regardless of recency', () => {
    const result = sortQuickTasks(
      [task(1, 'Done', 28), task(2, 'To Do', 10)],
      []
    );
    expect(result.map((t) => t.id)).toEqual([2, 1]);
  });

  it('puts pinned tasks first', () => {
    const result = sortQuickTasks(
      [task(1, 'To Do', 28), task(2, 'To Do', 10), task(3, 'To Do', 20)],
      [2]
    );
    expect(result.map((t) => t.id)).toEqual([2, 1, 3]);
  });

  it('keeps pinned tasks in the order they were pinned', () => {
    const result = sortQuickTasks(
      [task(1, 'To Do', 10), task(2, 'To Do', 20), task(3, 'To Do', 30)],
      [3, 1]
    );
    expect(result.map((t) => t.id)).toEqual([3, 1, 2]);
  });

  // A pin is deliberate, so it outranks even being finished.
  it('keeps a pinned finished task at the top', () => {
    const result = sortQuickTasks(
      [task(1, 'To Do', 10), task(2, 'Done', 20)],
      [2]
    );
    expect(result.map((t) => t.id)).toEqual([2, 1]);
  });

  it('ignores a pinned id that is not in the list', () => {
    const result = sortQuickTasks([task(1, 'To Do', 10)], [999]);
    expect(result.map((t) => t.id)).toEqual([1]);
  });

  it('falls back to id order when change dates tie', () => {
    const result = sortQuickTasks(
      [task(1, 'To Do', 10), task(2, 'To Do', 10)],
      []
    );
    expect(result.map((t) => t.id)).toEqual([2, 1]);
  });

  it('does not mutate its input', () => {
    const items = [task(1, 'Done', 10), task(2, 'To Do', 20)];
    sortQuickTasks(items, [1]);
    expect(items.map((t) => t.id)).toEqual([1, 2]);
  });

  it('returns an empty list unchanged', () => {
    expect(sortQuickTasks([], [1])).toEqual([]);
  });
});

describe('togglePinnedId', () => {
  it('pins an unpinned id at the end', () => {
    expect(togglePinnedId([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it('unpins a pinned id', () => {
    expect(togglePinnedId([1, 2, 3], 2)).toEqual([1, 3]);
  });

  it('does not mutate its input', () => {
    const pinned = [1];
    togglePinnedId(pinned, 2);
    expect(pinned).toEqual([1]);
  });
});
