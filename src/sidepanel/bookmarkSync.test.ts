import {
  collectFolderParentCandidates,
  findFolderByName,
  isBookmarkSyncPlanEmpty,
  planBookmarkSync,
  reconcileFavoritesWithBookmarks,
  type BookmarkBaseline,
  type BookmarkNode
} from './bookmarkSync';
import type { StarredPage } from './starredPages';

function favorite(url: string, label: string): StarredPage {
  return { url, label, starredAt: 0 };
}

function node(id: string, title: string, url?: string): BookmarkNode {
  return { id, title, url };
}

describe('planBookmarkSync', () => {
  it('creates bookmarks for new favorites', () => {
    const plan = planBookmarkSync([], [favorite('https://x.invalid/a', 'A')]);
    expect(plan.create).toEqual([{ title: 'A', url: 'https://x.invalid/a' }]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('does nothing when the folder already matches', () => {
    const plan = planBookmarkSync(
      [node('1', 'A', 'https://x.invalid/a')],
      [favorite('https://x.invalid/a', 'A')]
    );
    expect(isBookmarkSyncPlanEmpty(plan)).toBe(true);
  });

  // Matching by url means a rename keeps the same bookmark, not a new one.
  it('retitles in place when a favorite is renamed', () => {
    const plan = planBookmarkSync(
      [node('1', 'Old', 'https://x.invalid/a')],
      [favorite('https://x.invalid/a', 'New')]
    );
    expect(plan.update).toEqual([
      { id: '1', title: 'New', url: 'https://x.invalid/a' }
    ]);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('removes bookmarks whose favorite is gone', () => {
    const plan = planBookmarkSync(
      [
        node('1', 'A', 'https://x.invalid/a'),
        node('2', 'B', 'https://x.invalid/b')
      ],
      [favorite('https://x.invalid/a', 'A')]
    );
    expect(plan.remove).toEqual(['2']);
  });

  it('removes duplicate bookmarks for the same url', () => {
    const plan = planBookmarkSync(
      [
        node('1', 'A', 'https://x.invalid/a'),
        node('2', 'A', 'https://x.invalid/a')
      ],
      [favorite('https://x.invalid/a', 'A')]
    );
    expect(plan.remove).toEqual(['2']);
    expect(plan.create).toEqual([]);
  });

  // Something the user put in the folder by hand should survive.
  it('leaves nested folders alone', () => {
    const plan = planBookmarkSync([node('9', 'Subfolder')], []);
    expect(plan.remove).toEqual([]);
  });

  it('handles a mix of create, update and remove', () => {
    const plan = planBookmarkSync(
      [
        node('1', 'Old', 'https://x.invalid/a'),
        node('2', 'Gone', 'https://x.invalid/z')
      ],
      [
        favorite('https://x.invalid/a', 'New'),
        favorite('https://x.invalid/b', 'B')
      ]
    );
    expect(plan.update.map((u) => u.id)).toEqual(['1']);
    expect(plan.create.map((c) => c.url)).toEqual(['https://x.invalid/b']);
    expect(plan.remove).toEqual(['2']);
  });

  it('is empty for no favorites and an empty folder', () => {
    expect(isBookmarkSyncPlanEmpty(planBookmarkSync([], []))).toBe(true);
  });
});

describe('collectFolderParentCandidates', () => {
  // Root ids differ between browsers, so they are discovered rather than
  // assumed — hardcoding Chrome's "2" made the mirror fail in Edge.
  const tree = [
    {
      id: '0',
      title: '',
      children: [
        { id: '1', title: 'Bookmarks bar' },
        { id: '2', title: 'Other bookmarks' },
        { id: '3', title: 'Mobile bookmarks' }
      ]
    }
  ];

  it('offers the root folders, later ones first', () => {
    expect(collectFolderParentCandidates(tree)).toEqual(['3', '2', '1']);
  });

  it('skips leaf bookmarks among the roots', () => {
    expect(
      collectFolderParentCandidates([
        {
          id: '0',
          title: '',
          children: [
            { id: '1', title: 'Bar' },
            { id: '9', title: 'A link', url: 'https://x.invalid' }
          ]
        }
      ])
    ).toEqual(['1']);
  });

  it('accepts a tree given without a wrapping root', () => {
    expect(
      collectFolderParentCandidates([{ id: '5', title: 'Favourites' }])
    ).toEqual(['5']);
  });

  it('returns nothing for an empty tree', () => {
    expect(collectFolderParentCandidates([])).toEqual([]);
  });
});

describe('findFolderByName', () => {
  const tree = [
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: 'Bookmarks bar',
          children: [{ id: '4', title: 'my-favorites', children: [] }]
        },
        { id: '2', title: 'Other bookmarks', children: [] }
      ]
    }
  ];

  // Reuse the folder wherever the user has moved it, rather than making a second.
  it('finds a nested folder by name', () => {
    expect(findFolderByName(tree, 'my-favorites')).toBe('4');
  });

  it('ignores bookmarks that merely share the title', () => {
    expect(
      findFolderByName(
        [{ id: '9', title: 'my-favorites', url: 'https://x.invalid' }],
        'my-favorites'
      )
    ).toBeNull();
  });

  it('returns null when absent', () => {
    expect(findFolderByName(tree, 'nope')).toBeNull();
  });
});

describe('reconcileFavoritesWithBookmarks', () => {
  const NOW = 1_760_000_000_000;

  function reconcile(
    bookmarks: BookmarkNode[],
    favorites: StarredPage[],
    baseline: BookmarkBaseline
  ) {
    return reconcileFavoritesWithBookmarks({
      bookmarks,
      favorites,
      baseline,
      now: NOW
    });
  }

  function favorite(url: string, label: string): StarredPage {
    return { url, label, starredAt: 1 };
  }

  it('adopts a bookmark that arrived from another machine', () => {
    const result = reconcile(
      [{ id: 'b1', title: 'Sprint board', url: 'https://example.test/boards' }],
      [],
      {}
    );

    expect(result.favorites).toEqual([
      {
        url: 'https://example.test/boards',
        label: 'Sprint board',
        starredAt: NOW
      }
    ]);
    expect(result.adopted).toEqual(['https://example.test/boards']);
    expect(isBookmarkSyncPlanEmpty(result.plan)).toBe(true);
    expect(result.baseline).toEqual({
      'https://example.test/boards': 'Sprint board'
    });
  });

  it('pushes a favorite added here that the folder has never seen', () => {
    const result = reconcile(
      [],
      [favorite('https://example.test/q', 'My query')],
      {}
    );

    expect(result.plan.create).toEqual([
      { title: 'My query', url: 'https://example.test/q' }
    ]);
    expect(result.favorites).toHaveLength(1);
    expect(result.droppedRemotely).toEqual([]);
  });

  it('drops a favorite whose bookmark was deleted on another machine', () => {
    const result = reconcile(
      [],
      [favorite('https://example.test/q', 'My query')],
      {
        'https://example.test/q': 'My query'
      }
    );

    expect(result.favorites).toEqual([]);
    expect(result.droppedRemotely).toEqual(['https://example.test/q']);
    expect(result.plan.create).toEqual([]);
  });

  it('takes a rename that came from the folder', () => {
    const result = reconcile(
      [{ id: 'b1', title: 'Renamed elsewhere', url: 'https://example.test/q' }],
      [favorite('https://example.test/q', 'Old name')],
      { 'https://example.test/q': 'Old name' }
    );

    expect(result.favorites[0]?.label).toBe('Renamed elsewhere');
    expect(result.renamedRemotely).toEqual(['https://example.test/q']);
    expect(result.plan.update).toEqual([]);
  });

  it('pushes a rename made here when the folder still holds the old title', () => {
    const result = reconcile(
      [{ id: 'b1', title: 'Old name', url: 'https://example.test/q' }],
      [favorite('https://example.test/q', 'New name')],
      { 'https://example.test/q': 'Old name' }
    );

    expect(result.favorites[0]?.label).toBe('New name');
    expect(result.plan.update).toEqual([
      { id: 'b1', title: 'New name', url: 'https://example.test/q' }
    ]);
    expect(result.renamedRemotely).toEqual([]);
  });

  it('matches a bookmark saved with a fragment or trailing slash', () => {
    const result = reconcile(
      [{ id: 'b1', title: 'Board', url: 'https://example.test/boards/#tab' }],
      [favorite('https://example.test/boards', 'Board')],
      { 'https://example.test/boards': 'Board' }
    );

    expect(result.favorites).toHaveLength(1);
    expect(result.adopted).toEqual([]);
    expect(isBookmarkSyncPlanEmpty(result.plan)).toBe(true);
  });

  it('removes a duplicate bookmark for a page it already matched', () => {
    const result = reconcile(
      [
        { id: 'b1', title: 'Board', url: 'https://example.test/boards' },
        { id: 'b2', title: 'Board', url: 'https://example.test/boards/' }
      ],
      [favorite('https://example.test/boards', 'Board')],
      { 'https://example.test/boards': 'Board' }
    );

    expect(result.plan.remove).toEqual(['b2']);
    expect(result.favorites).toHaveLength(1);
  });

  it('leaves a sub-folder in the folder alone', () => {
    const result = reconcile([{ id: 'f1', title: 'Archive' }], [], {});

    expect(isBookmarkSyncPlanEmpty(result.plan)).toBe(true);
    expect(result.favorites).toEqual([]);
  });

  it('keeps local order and appends what it adopted', () => {
    const result = reconcile(
      [
        { id: 'b1', title: 'First', url: 'https://example.test/1' },
        { id: 'b2', title: 'Second', url: 'https://example.test/2' },
        { id: 'b3', title: 'Third', url: 'https://example.test/3' }
      ],
      [
        favorite('https://example.test/2', 'Second'),
        favorite('https://example.test/1', 'First')
      ],
      {
        'https://example.test/2': 'Second',
        'https://example.test/1': 'First'
      }
    );

    expect(result.favorites.map((page) => page.label)).toEqual([
      'Second',
      'First',
      'Third'
    ]);
  });

  it('is stable: reconciling its own output changes nothing', () => {
    const bookmarks: BookmarkNode[] = [
      { id: 'b1', title: 'Board', url: 'https://example.test/boards' }
    ];
    const first = reconcile(bookmarks, [], {});
    const second = reconcile(bookmarks, first.favorites, first.baseline);

    expect(second.favorites).toEqual(first.favorites);
    expect(isBookmarkSyncPlanEmpty(second.plan)).toBe(true);
    expect(second.adopted).toEqual([]);
    expect(second.droppedRemotely).toEqual([]);
  });
});

describe('reconcileFavoritesWithBookmarks with local removals', () => {
  it('deletes the bookmark for a page unstarred here instead of adopting it', () => {
    const result = reconcileFavoritesWithBookmarks({
      bookmarks: [
        { id: 'b1', title: 'Board', url: 'https://example.test/boards' }
      ],
      favorites: [],
      baseline: { 'https://example.test/boards': 'Board' },
      now: 5,
      removedLocally: ['https://example.test/boards']
    });

    expect(result.plan.remove).toEqual(['b1']);
    expect(result.favorites).toEqual([]);
    expect(result.adopted).toEqual([]);
    expect(result.baseline).toEqual({});
  });

  it('still adopts other machines’ bookmarks in the same pass', () => {
    const result = reconcileFavoritesWithBookmarks({
      bookmarks: [
        { id: 'b1', title: 'Gone', url: 'https://example.test/gone' },
        { id: 'b2', title: 'New', url: 'https://example.test/new' }
      ],
      favorites: [],
      baseline: { 'https://example.test/gone': 'Gone' },
      now: 5,
      removedLocally: ['https://example.test/gone']
    });

    expect(result.plan.remove).toEqual(['b1']);
    expect(result.adopted).toEqual(['https://example.test/new']);
  });
});
