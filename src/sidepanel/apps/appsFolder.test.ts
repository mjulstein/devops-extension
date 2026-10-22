import {
  APPS_BOOKMARK_FOLDER,
  findAppsFolder,
  readAppsFromFolder,
  type AppsTreeNode
} from './appsFolder';

const tree: AppsTreeNode[] = [
  {
    id: '0',
    children: [
      {
        id: '1',
        title: 'Bookmarks bar',
        children: [
          {
            id: '2',
            title: 'ops',
            children: [
              { id: '3', title: 'A favorite', url: 'https://example.test/' },
              {
                id: '4',
                title: APPS_BOOKMARK_FOLDER,
                children: [
                  {
                    id: '5',
                    title: 'my-app',
                    children: [
                      {
                        id: '6',
                        title: 'live',
                        url: 'https://my-app.org.com/'
                      },
                      {
                        id: '7',
                        title: 'test',
                        url: 'https://my-app-test.org.com/'
                      }
                    ]
                  },
                  { id: '8', title: 'new-app', children: [] }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

describe('findAppsFolder', () => {
  it('finds Apps inside the named favorites folder', () => {
    expect(findAppsFolder(tree, 'ops')?.id).toBe('4');
  });

  it('is null when the favorites folder is not there', () => {
    expect(findAppsFolder(tree, 'nope')).toBeNull();
  });
});

describe('readAppsFromFolder', () => {
  it('reads a folder per app and a bookmark per environment, in order', () => {
    expect(readAppsFromFolder(findAppsFolder(tree, 'ops'))).toEqual([
      {
        name: 'my-app',
        environments: [
          { name: 'live', url: 'https://my-app.org.com/' },
          { name: 'test', url: 'https://my-app-test.org.com/' }
        ]
      },
      { name: 'new-app', environments: [] }
    ]);
  });

  it('keeps an app that has no environments yet', () => {
    // It is what a folder looks like between being made and being filled.
    const apps = readAppsFromFolder(findAppsFolder(tree, 'ops'));
    expect(apps[1]).toEqual({ name: 'new-app', environments: [] });
  });

  it('ignores a loose bookmark sitting beside the app folders', () => {
    const apps = readAppsFromFolder({
      id: 'x',
      title: APPS_BOOKMARK_FOLDER,
      children: [
        { id: 'y', title: 'stray', url: 'https://stray.test/' },
        { id: 'z', title: 'app', children: [] }
      ]
    });
    expect(apps.map((app) => app.name)).toEqual(['app']);
  });

  it('is empty when there is no Apps folder', () => {
    expect(readAppsFromFolder(null)).toEqual([]);
  });
});

describe('readAppsFromFolder with sub-groups', () => {
  it('offers a page kept in a sub-group under the app it belongs to', () => {
    // The `-` walk is where you go looking for it; leaving it out would make
    // a partial answer look like a complete one.
    const apps = readAppsFromFolder({
      id: 'apps',
      title: 'Apps',
      children: [
        {
          id: 'f1',
          title: 'example.com',
          children: [
            { id: 'b1', title: 'Home', url: 'https://example.com/' },
            {
              id: 's1',
              title: 'example.com/spaces',
              children: [
                {
                  id: 'b2',
                  title: 'Eng',
                  url: 'https://example.com/spaces/eng'
                }
              ]
            }
          ]
        }
      ]
    });
    expect(apps[0].environments.map((env) => env.name)).toEqual([
      'Home',
      'Eng'
    ]);
  });
});
