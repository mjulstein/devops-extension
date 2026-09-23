import {
  bookmarksInFolder,
  collectBookmarkFolders,
  matchBookmarkFolders
} from './bookmarkFolders';

const TREE = [
  {
    id: 'root',
    title: '',
    children: [
      {
        id: 'bar',
        title: 'Bookmarks bar',
        children: [
          { id: '1', title: 'Weather', url: 'https://weather.test/' },
          {
            id: 'work',
            title: 'Work',
            children: [
              { id: '2', title: 'Team wiki', url: 'https://wiki.test/team' },
              { id: '3', title: 'Payroll', url: 'https://hr.test/payroll' },
              { id: 'empty', title: 'Archive', children: [] }
            ]
          }
        ]
      }
    ]
  }
];

describe('collectBookmarkFolders', () => {
  it('lists named folders that actually hold bookmarks', () => {
    const folders = collectBookmarkFolders(TREE);

    expect(folders.map((folder) => [folder.title, folder.count])).toEqual([
      ['Bookmarks bar', 1],
      ['Work', 2]
    ]);
  });

  it('leaves out an empty folder, which would be a dead end', () => {
    expect(
      collectBookmarkFolders(TREE).some((folder) => folder.title === 'Archive')
    ).toBe(false);
  });

  it('records the ancestors, so two folders with one name can be told apart', () => {
    const work = collectBookmarkFolders(TREE).find((f) => f.title === 'Work');

    expect(work?.path).toBe('Bookmarks bar');
  });
});

describe('matchBookmarkFolders', () => {
  const folders = collectBookmarkFolders(TREE);

  it('offers every folder when nothing is typed', () => {
    expect(matchBookmarkFolders(folders, '')).toHaveLength(2);
  });

  it('matches on the folder name, case-insensitively', () => {
    expect(matchBookmarkFolders(folders, 'wor').map((f) => f.title)).toEqual([
      'Work'
    ]);
  });
});

describe('bookmarksInFolder', () => {
  it('returns what is directly inside, with the folder name attached', () => {
    expect(bookmarksInFolder(TREE, 'work')).toEqual([
      { url: 'https://wiki.test/team', title: 'Team wiki', folder: 'Work' },
      { url: 'https://hr.test/payroll', title: 'Payroll', folder: 'Work' }
    ]);
  });

  it('returns nothing for a folder that is not there', () => {
    expect(bookmarksInFolder(TREE, 'nope')).toEqual([]);
  });
});
