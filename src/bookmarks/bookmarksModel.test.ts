import {
  canDropInto,
  duplicateFolderNameGroups,
  filterFolderGroups,
  duplicateNameGroups,
  duplicatePathGroups,
  emptyFolders,
  filterEntries,
  filterGroups,
  flattenBookmarks,
  planFlatten,
  urlWithoutSearch,
  type BookmarkNode
} from './bookmarksModel';

function tree(): BookmarkNode[] {
  return [
    {
      id: '1',
      title: 'Bookmarks bar',
      children: [
        {
          id: '10',
          parentId: '1',
          title: 'Work',
          children: [
            {
              id: '100',
              parentId: '10',
              title: 'Board',
              url: 'https://x.test/board?a=1'
            },
            {
              id: '101',
              parentId: '10',
              title: 'Queries',
              url: 'https://x.test/queries'
            }
          ]
        },
        {
          id: '11',
          parentId: '1',
          title: 'Archive',
          children: [
            {
              id: '110',
              parentId: '11',
              title: 'Board',
              url: 'https://x.test/board?a=2'
            }
          ]
        },
        { id: '12', parentId: '1', title: 'Old', children: [] }
      ]
    }
  ];
}

describe('flattenBookmarks', () => {
  it('carries the folder path with each bookmark', () => {
    const entries = flattenBookmarks(tree());
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      id: '100',
      parentId: '10',
      folderPath: 'Bookmarks bar / Work'
    });
  });
});

describe('urlWithoutSearch', () => {
  it('drops search params, hash and a trailing slash', () => {
    expect(urlWithoutSearch('https://x.test/board/?a=1#f')).toBe(
      'https://x.test/board'
    );
  });

  it('falls back to the raw text for something unparseable', () => {
    expect(urlWithoutSearch('not a url')).toBe('not a url');
  });
});

describe('duplicateNameGroups', () => {
  it('groups same-titled bookmarks regardless of folder', () => {
    const groups = duplicateNameGroups(flattenBookmarks(tree()));
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('board');
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(['100', '110']);
  });
});

describe('duplicatePathGroups', () => {
  it('ignores search params when comparing', () => {
    const groups = duplicatePathGroups(flattenBookmarks(tree()));
    expect(groups.map((group) => group.key)).toEqual(['https://x.test/board']);
  });

  it('leaves copies that share a folder to the main list', () => {
    const entries = flattenBookmarks([
      {
        id: '1',
        title: 'Bar',
        children: [
          { id: '2', parentId: '1', title: 'A', url: 'https://x.test/p?a=1' },
          { id: '3', parentId: '1', title: 'B', url: 'https://x.test/p?a=2' }
        ]
      }
    ]);
    expect(duplicatePathGroups(entries)).toEqual([]);
  });
});

describe('duplicateFolderNameGroups', () => {
  it('groups folders sharing a name, ignoring case', () => {
    const groups = duplicateFolderNameGroups([
      {
        id: '1',
        title: 'Bar',
        children: [
          { id: '10', parentId: '1', title: 'Work', children: [] },
          {
            id: '11',
            parentId: '1',
            title: 'Old',
            children: [
              { id: '110', parentId: '11', title: 'work', children: [] }
            ]
          }
        ]
      }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('work');
    expect(groups[0].folders.map((folder) => folder.id)).toEqual(['10', '110']);
  });

  it('leaves a name used once alone', () => {
    expect(duplicateFolderNameGroups(tree())).toEqual([]);
  });

  it('filters a group down to its matching folders', () => {
    const groups = duplicateFolderNameGroups([
      {
        id: '1',
        title: 'Bar',
        children: [
          { id: '10', parentId: '1', title: 'Work', children: [] },
          {
            id: '11',
            parentId: '1',
            title: 'Old',
            children: [
              { id: '110', parentId: '11', title: 'Work', children: [] }
            ]
          }
        ]
      }
    ]);
    expect(
      filterFolderGroups(groups, 'old')[0].folders.map((f) => f.id)
    ).toEqual(['110']);
    expect(filterFolderGroups(groups, 'zzz')).toEqual([]);
  });
});

describe('emptyFolders', () => {
  it('lists only folders with no children at all', () => {
    expect(emptyFolders(tree()).map((folder) => folder.id)).toEqual(['12']);
  });
});

describe('filters', () => {
  it('matches title, url and folder path', () => {
    const entries = flattenBookmarks(tree());
    expect(filterEntries(entries, 'archive').map((entry) => entry.id)).toEqual([
      '110'
    ]);
    expect(filterEntries(entries, 'queries')).toHaveLength(1);
  });

  it('drops a group whose members all fail the filter', () => {
    const groups = duplicateNameGroups(flattenBookmarks(tree()));
    expect(filterGroups(groups, 'archive')[0].entries).toHaveLength(1);
    expect(filterGroups(groups, 'nothing')).toEqual([]);
  });
});

describe('planFlatten', () => {
  function nested(): BookmarkNode[] {
    return [
      {
        id: 'root',
        title: 'path',
        children: [
          {
            id: 'to',
            parentId: 'root',
            title: 'to',
            children: [
              {
                id: 'first',
                parentId: 'to',
                title: 'First',
                url: 'https://x.test/1'
              },
              {
                id: 'flatten',
                parentId: 'to',
                title: 'flatten',
                children: [
                  {
                    id: 'that',
                    parentId: 'flatten',
                    title: 'that',
                    children: [
                      {
                        id: 'has',
                        parentId: 'that',
                        title: 'has',
                        children: []
                      }
                    ]
                  },
                  {
                    id: 'loose',
                    parentId: 'flatten',
                    title: 'Loose',
                    url: 'https://x.test/2'
                  }
                ]
              }
            ]
          }
        ]
      }
    ];
  }

  it('lifts the children into the grandparent, in the folder place', () => {
    const plan = planFlatten(nested(), 'flatten');
    expect(plan).toEqual({
      moves: [
        { id: 'that', parentId: 'to', index: 1 },
        { id: 'loose', parentId: 'to', index: 2 }
      ],
      removeId: 'flatten'
    });
  });

  it('leaves the nesting under a moved child alone', () => {
    // 'that' moves as one node, so 'has' travels with it untouched.
    const plan = planFlatten(nested(), 'flatten');
    expect(plan?.moves.some((move) => move.id === 'has')).toBe(false);
  });

  it('refuses an empty folder, which would just be a delete', () => {
    expect(planFlatten(nested(), 'has')).toBeNull();
  });

  it('refuses a root, whose parent cannot hold bookmarks', () => {
    expect(planFlatten(nested(), 'root')).toBeNull();
  });

  it('refuses a bookmark', () => {
    expect(planFlatten(nested(), 'first')).toBeNull();
  });
});

describe('canDropInto', () => {
  it('refuses a folder dropped into its own descendant', () => {
    expect(canDropInto(tree(), '1', '10')).toBe(false);
  });

  it('refuses a move that would change nothing', () => {
    expect(canDropInto(tree(), '100', '10')).toBe(false);
  });

  it('refuses a drop onto a bookmark', () => {
    expect(canDropInto(tree(), '100', '101')).toBe(false);
  });

  it('allows a bookmark into another folder', () => {
    expect(canDropInto(tree(), '100', '11')).toBe(true);
  });
});
