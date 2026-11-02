import {
  expandFolderName,
  readAppFolders,
  sameBase,
  unopenedBookmarks,
  type AppBookmark
} from './appGroups';

function mark(id: string, url: string): AppBookmark {
  return { id, name: id, url };
}

describe('readAppFolders', () => {
  const tree = {
    id: 'apps',
    title: 'Apps',
    children: [
      {
        id: 'app1',
        title: 'example.com',
        children: [
          { id: 'b1', title: 'Home', url: 'https://example.com/' },
          { id: 'b2', title: '  ', url: 'https://example.com/report' }
        ]
      },
      { id: 'app2', title: 'sub.example.com', children: [] }
    ]
  };

  it('reads one folder per app, with the bookmarks inside', () => {
    const [first, second] = readAppFolders(tree);
    expect(first.name).toBe('example.com');
    expect(first.bookmarks.map((b) => b.name)).toEqual([
      'Home',
      'https://example.com/report'
    ]);
    expect(second.name).toBe('sub.example.com');
  });

  it('keeps a folder with nothing in it yet', () => {
    expect(readAppFolders(tree)[1].bookmarks).toEqual([]);
  });

  it('is empty when there is no Apps folder', () => {
    expect(readAppFolders(null)).toEqual([]);
  });
});

describe('sameBase', () => {
  it('is the same place whatever the query says', () => {
    // A bookmark names a place; a query names a view of it.
    expect(sameBase('https://a.test/p?x=1', 'https://a.test/p?x=2')).toBe(true);
    expect(sameBase('https://a.test/p', 'https://a.test/p?x=1')).toBe(true);
  });

  it('ignores a fragment and a trailing slash', () => {
    expect(sameBase('https://a.test/p/', 'https://a.test/p#frag')).toBe(true);
  });

  it('is a different place on a different path or host', () => {
    expect(sameBase('https://a.test/p', 'https://a.test/q')).toBe(false);
    expect(sameBase('https://a.test/p', 'https://b.test/p')).toBe(false);
  });

  it('is false when either address cannot be read', () => {
    expect(sameBase('nonsense', 'https://a.test/')).toBe(false);
  });
});

describe('unopenedBookmarks', () => {
  const bookmarks = [
    mark('home', 'https://a.test/'),
    mark('report', 'https://a.test/report')
  ];

  it('leaves out the ones already open, query and all', () => {
    expect(
      unopenedBookmarks(bookmarks, ['https://a.test/report?from=2026']).map(
        (entry) => entry.id
      )
    ).toEqual(['home']);
  });

  it('keeps the ones with nothing open at their address', () => {
    expect(unopenedBookmarks(bookmarks, []).map((entry) => entry.id)).toEqual([
      'home',
      'report'
    ]);
  });
});

describe('expandFolderName', () => {
  it('fills the asterisk in from the folder it goes into', () => {
    expect(expandFolderName('something-*', 'my.url.com')).toBe(
      'something-my.url.com'
    );
    expect(expandFolderName('*/spaces', 'example.com')).toBe(
      'example.com/spaces'
    );
  });

  it('leaves a name that is already complete alone', () => {
    expect(expandFolderName('wiki.example.com', 'example.com')).toBe(
      'wiki.example.com'
    );
  });

  it('ignores a parent whose name is padded', () => {
    expect(expandFolderName('*-test', '  my.url.com ')).toBe('my.url.com-test');
  });
});

describe('readAppFolders sub-groups', () => {
  const folders = readAppFolders({
    id: 'apps',
    children: [
      {
        id: 'f',
        title: 'example.com',
        children: [
          { id: 'b', title: 'Home', url: 'https://example.com/' },
          {
            id: 's',
            title: 'example.com/spaces',
            children: [
              { id: 'b2', title: 'Eng', url: 'https://example.com/spaces/eng' }
            ]
          }
        ]
      }
    ]
  });

  it('reads the folders inside an app as its sub-groups', () => {
    expect(folders[0].subGroups.map((sub) => sub.name)).toEqual([
      'example.com/spaces'
    ]);
  });

  it('keeps a sub-group own bookmarks with it', () => {
    expect(folders[0].subGroups[0].bookmarks.map((b) => b.name)).toEqual([
      'Eng'
    ]);
  });

  it('leaves the app own bookmarks where they are', () => {
    expect(folders[0].bookmarks.map((b) => b.name)).toEqual(['Home']);
  });
});
