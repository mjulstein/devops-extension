import {
  buildBookmarkTitle,
  describeQuickTaskBookmarkSync,
  planQuickTaskBookmarks
} from './quickTaskBookmarks';
import type { WorkItem } from '@/types';

function task(overrides: Partial<WorkItem> & { id: number }): WorkItem {
  return {
    workItemType: 'Task',
    title: `Task ${overrides.id}`,
    state: 'In Progress',
    assignedTo: 'me',
    parentId: null,
    parent: null,
    closedDate: null,
    lastChangedDate: null,
    url: `https://dev.azure.test/org/proj/_workitems/edit/${overrides.id}`,
    ...overrides
  };
}

describe('planQuickTaskBookmarks', () => {
  it('bookmarks the tasks that are in progress, and only those', () => {
    const plan = planQuickTaskBookmarks({
      tasks: [
        task({ id: 1, state: 'In Progress' }),
        task({ id: 2, state: 'To Do' }),
        task({ id: 3, state: 'Done' })
      ],
      bookmarks: []
    });

    expect(plan.create).toEqual([
      {
        url: 'https://dev.azure.test/org/proj/_workitems/edit/1',
        title: '#1 Task 1'
      }
    ]);
    expect(plan.remove).toEqual([]);
  });

  it('deletes the bookmark of a task that finished', () => {
    const plan = planQuickTaskBookmarks({
      tasks: [task({ id: 1, state: 'Done' })],
      bookmarks: [
        {
          id: 'b1',
          title: '#1 Task 1',
          url: 'https://dev.azure.test/org/proj/_workitems/edit/1'
        }
      ]
    });

    expect(plan.remove).toEqual(['b1']);
    expect(plan.create).toEqual([]);
  });

  it('deletes the bookmark of a task that is no longer returned at all', () => {
    const plan = planQuickTaskBookmarks({
      tasks: [],
      bookmarks: [
        {
          id: 'b9',
          title: '#9 Gone',
          url: 'https://dev.azure.test/org/proj/_workitems/edit/9'
        }
      ]
    });

    expect(plan.remove).toEqual(['b9']);
  });

  it('keeps a renamed task and corrects its bookmark, rather than replacing it', () => {
    const plan = planQuickTaskBookmarks({
      tasks: [task({ id: 1, title: 'Renamed' })],
      bookmarks: [
        {
          id: 'b1',
          title: '#1 Task 1',
          url: 'https://dev.azure.test/org/proj/_workitems/edit/1'
        }
      ]
    });

    expect(plan.update).toEqual([{ id: 'b1', title: '#1 Renamed' }]);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('leaves an already-correct bookmark alone', () => {
    const plan = planQuickTaskBookmarks({
      tasks: [task({ id: 1 })],
      bookmarks: [
        {
          id: 'b1',
          title: '#1 Task 1',
          url: 'https://dev.azure.test/org/proj/_workitems/edit/1'
        }
      ]
    });

    expect(plan).toEqual({ create: [], update: [], remove: [] });
  });

  it('removes a duplicate the browser’s own sync produced', () => {
    const plan = planQuickTaskBookmarks({
      tasks: [task({ id: 1 })],
      bookmarks: [
        {
          id: 'b1',
          title: '#1 Task 1',
          url: 'https://dev.azure.test/org/proj/_workitems/edit/1'
        },
        {
          id: 'b2',
          title: '#1 Task 1',
          url: 'https://dev.azure.test/org/proj/_workitems/edit/1'
        }
      ]
    });

    expect(plan.remove).toEqual(['b2']);
  });

  it('leaves sub-folders someone put there alone', () => {
    const plan = planQuickTaskBookmarks({
      tasks: [],
      bookmarks: [{ id: 'f1', title: 'Notes' }]
    });

    expect(plan.remove).toEqual([]);
  });
});

describe('buildBookmarkTitle', () => {
  it('always carries the task name, with the id to tell similar work apart', () => {
    expect(
      buildBookmarkTitle(task({ id: 42, title: 'Fix the flaky test' }))
    ).toBe('#42 Fix the flaky test');
  });

  it('collapses the whitespace a pasted title brings with it', () => {
    expect(buildBookmarkTitle(task({ id: 7, title: '  Two   words \n' }))).toBe(
      '#7 Two words'
    );
  });

  it('falls back to the id when a task somehow has no title', () => {
    expect(buildBookmarkTitle(task({ id: 7, title: '   ' }))).toBe('#7');
  });
});

describe('describeQuickTaskBookmarkSync', () => {
  it('says nothing when nothing changed, so a quiet sync stays quiet', () => {
    expect(
      describeQuickTaskBookmarkSync({ create: [], update: [], remove: [] })
    ).toBeNull();
  });

  it('counts what it did', () => {
    const text = describeQuickTaskBookmarkSync({
      create: [{ url: 'u', title: 't' }],
      update: [],
      remove: ['a', 'b']
    });

    expect(text).toBe('Quick task bookmarks: added 1, removed 2.');
  });
});
