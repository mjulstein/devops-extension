import { groupKeyOf, planGroupedTabOrder } from './tabArrangement';
import type { AppFolder } from './appGroups';

const folders: AppFolder[] = [
  { id: 'f1', name: 'example.com', bookmarks: [], subGroups: [] },
  { id: 'f2', name: 'sub.example.com', bookmarks: [], subGroups: [] }
];

describe('groupKeyOf', () => {
  it('uses the app folder, longest name winning', () => {
    expect(groupKeyOf('https://example.com/a', folders)).toBe(
      'app:example.com'
    );
    expect(groupKeyOf('https://sub.example.com/a', folders)).toBe(
      'app:sub.example.com'
    );
  });

  it('falls back to an Azure DevOps section, which is a group without a folder', () => {
    expect(groupKeyOf('https://dev.azure.com/o/p/_git/r', [])).toBe(
      'ado:repos'
    );
  });

  it('falls back to the host, so the ungrouped still sit with their own kind', () => {
    expect(groupKeyOf('https://news.test/story', folders)).toBe(
      'host:news.test'
    );
  });
});

describe('planGroupedTabOrder', () => {
  function tab(id: number, url: string, index: number, extra = {}) {
    return { id, url, index, windowId: 1, ...extra };
  }

  it('gathers each group into one run', () => {
    const moves = planGroupedTabOrder(
      [
        tab(1, 'https://example.com/a', 0),
        tab(2, 'https://news.test/x', 1),
        tab(3, 'https://example.com/b', 2)
      ],
      folders
    );
    expect(moves).toEqual([
      { id: 1, index: 0 },
      { id: 3, index: 1 },
      { id: 2, index: 2 }
    ]);
  });

  it('keeps the order tabs already had within a group', () => {
    // Sorting gathers; it does not shuffle. Two tabs side by side stay so.
    const moves = planGroupedTabOrder(
      [
        tab(1, 'https://example.com/second', 0),
        tab(2, 'https://example.com/first', 1)
      ],
      folders
    );
    expect(moves.map((move) => move.id)).toEqual([1, 2]);
  });

  it('keeps the groups in the order they first appear', () => {
    const moves = planGroupedTabOrder(
      [tab(1, 'https://news.test/x', 0), tab(2, 'https://example.com/a', 1)],
      folders
    );
    expect(moves.map((move) => move.id)).toEqual([1, 2]);
  });

  it('plans each window on its own', () => {
    const moves = planGroupedTabOrder(
      [
        tab(1, 'https://example.com/a', 0),
        tab(2, 'https://news.test/x', 0, { windowId: 2 }),
        tab(3, 'https://example.com/b', 1, { windowId: 2 })
      ],
      folders
    );
    expect(moves).toEqual([
      { id: 1, index: 0 },
      { id: 2, index: 0 },
      { id: 3, index: 1 }
    ]);
  });

  it('leaves pinned tabs where the browser keeps them', () => {
    // Moving one out of the pinned run is an error, not a rearrangement.
    const moves = planGroupedTabOrder(
      [
        tab(1, 'https://news.test/x', 0, { pinned: true }),
        tab(2, 'https://example.com/a', 1)
      ],
      folders
    );
    expect(moves).toEqual([{ id: 2, index: 1 }]);
  });

  it('ignores a tab with no id or address to move', () => {
    expect(planGroupedTabOrder([{ windowId: 1, index: 0 }], folders)).toEqual(
      []
    );
  });
});
