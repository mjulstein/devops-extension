import {
  describeTabAge,
  groupAdoTabs,
  readAdoTabs,
  repoNameOf,
  toTabGroupNodes,
  type OpenTab
} from './adoTabs';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_000 * DAY;

function tab(id: number, url: string, daysOld?: number): OpenTab {
  return {
    id,
    url,
    title: `Tab ${id}`,
    lastAccessed: daysOld === undefined ? undefined : now - daysOld * DAY
  };
}

describe('readAdoTabs', () => {
  it('keeps only the Azure DevOps tabs', () => {
    const tabs = readAdoTabs([
      tab(1, 'https://dev.azure.com/o/p/_boards/board', 1),
      tab(2, 'https://example.test/', 1)
    ]);
    expect(tabs.map((entry) => entry.id)).toEqual([1]);
  });

  it('reads the section off the address', () => {
    const [boards, repos] = readAdoTabs([
      tab(1, 'https://dev.azure.com/o/p/_boards/board', 1),
      tab(2, 'https://dev.azure.com/o/p/_git/repo', 1)
    ]);
    expect(boards.section).toBe('boards');
    expect(repos.section).toBe('repos');
  });

  it('keeps the path and query, which is what tells two apart', () => {
    const [entry] = readAdoTabs([
      tab(1, 'https://dev.azure.com/o/p/_git/repo?version=GBmain', 1)
    ]);
    expect(entry.path).toBe('/o/p/_git/repo?version=GBmain');
  });

  it('falls back to the address when a tab has no title', () => {
    const [entry] = readAdoTabs([
      { id: 1, url: 'https://dev.azure.com/o/p/_wiki/x', title: '   ' }
    ]);
    expect(entry.title).toBe('https://dev.azure.com/o/p/_wiki/x');
  });

  it('skips a tab with no id to act on', () => {
    expect(readAdoTabs([{ url: 'https://dev.azure.com/o/p/_wiki/x' }])).toEqual(
      []
    );
  });
});

describe('groupAdoTabs', () => {
  it('groups by section, in Azure DevOps own nav order', () => {
    const groups = groupAdoTabs(
      readAdoTabs([
        tab(1, 'https://dev.azure.com/o/p/_git/repo', 1),
        tab(2, 'https://dev.azure.com/o/p/_boards/board', 1),
        tab(3, 'https://dev.azure.com/o/p/_wiki/page', 1)
      ])
    );
    expect(groups.map((group) => group.label)).toEqual([
      'Boards',
      'Repos',
      'Wiki'
    ]);
  });

  it('leaves out a section with nothing open', () => {
    const groups = groupAdoTabs(
      readAdoTabs([tab(1, 'https://dev.azure.com/o/p/_wiki/page', 1)])
    );
    expect(groups).toHaveLength(1);
  });

  it('puts the oldest first within a section', () => {
    const groups = groupAdoTabs(
      readAdoTabs([
        tab(1, 'https://dev.azure.com/o/p/_git/a', 1),
        tab(2, 'https://dev.azure.com/o/p/_git/b', 30),
        tab(3, 'https://dev.azure.com/o/p/_git/c', 10)
      ])
    );
    expect(groups[0].tabs.map((entry) => entry.id)).toEqual([2, 3, 1]);
  });

  it('breaks a tie on the address, so one repo tabs sit together', () => {
    const groups = groupAdoTabs(
      readAdoTabs([
        tab(1, 'https://dev.azure.com/o/p/_git/zebra', 5),
        tab(2, 'https://dev.azure.com/o/p/_git/alpha', 5)
      ])
    );
    expect(groups[0].tabs.map((entry) => entry.id)).toEqual([2, 1]);
  });

  it('sorts a tab of unknown age last, not first', () => {
    // Not knowing how old it is is not the same as it being old.
    const groups = groupAdoTabs(
      readAdoTabs([
        tab(1, 'https://dev.azure.com/o/p/_git/a'),
        tab(2, 'https://dev.azure.com/o/p/_git/b', 30)
      ])
    );
    expect(groups[0].tabs.map((entry) => entry.id)).toEqual([2, 1]);
  });
});

describe('describeTabAge', () => {
  const [old, recent, fresh] = readAdoTabs([
    tab(1, 'https://dev.azure.com/o/p/_git/a', 3),
    tab(2, 'https://dev.azure.com/o/p/_git/b', 0.25),
    tab(3, 'https://dev.azure.com/o/p/_git/c', 0)
  ]);

  it('counts days once there is a day to count', () => {
    expect(describeTabAge(old, now)).toBe('3 days ago');
  });

  it('counts hours below that', () => {
    expect(describeTabAge(recent, now)).toBe('6h ago');
  });

  it('says just now for the one you are on', () => {
    expect(describeTabAge(fresh, now)).toBe('just now');
  });

  it('says plainly when the browser does not know', () => {
    const [unknown] = readAdoTabs([tab(9, 'https://dev.azure.com/o/p/_git/z')]);
    expect(describeTabAge(unknown, now)).toBe('never opened in this session');
  });
});

describe('repoNameOf', () => {
  it('reads the repository out of the address', () => {
    expect(repoNameOf('https://dev.azure.com/o/p/_git/my-repo')).toBe(
      'my-repo'
    );
    expect(
      repoNameOf('https://dev.azure.com/o/p/_git/my-repo/pullrequest/4')
    ).toBe('my-repo');
  });

  it('decodes a name that had to be escaped', () => {
    expect(repoNameOf('https://dev.azure.com/o/p/_git/my%20repo')).toBe(
      'my repo'
    );
  });

  it('is null where the address names no repository', () => {
    expect(repoNameOf('https://dev.azure.com/o/p/_git')).toBeNull();
    expect(
      repoNameOf('https://dev.azure.com/o/p/_versioncontrol/x')
    ).toBeNull();
    expect(repoNameOf('not a url')).toBeNull();
  });
});

describe('toTabGroupNodes', () => {
  function nodesFor(urls: string[]) {
    return toTabGroupNodes(
      groupAdoTabs(
        readAdoTabs(urls.map((url, index) => tab(index + 1, url, 1)))
      )
    );
  }

  it('sections the repos group per repository, named and in order', () => {
    const [repos] = nodesFor([
      'https://dev.azure.com/o/p/_git/zebra',
      'https://dev.azure.com/o/p/_git/alpha/pullrequest/1',
      'https://dev.azure.com/o/p/_git/alpha'
    ]);
    expect(repos.label).toBe('Repos');
    expect(repos.tabs).toEqual([]);
    expect(repos.children.map((child) => child.label)).toEqual([
      'alpha',
      'zebra'
    ]);
    expect(repos.children[0].tabs).toHaveLength(2);
  });

  it('keeps an address with no repository in Other', () => {
    const [repos] = nodesFor([
      'https://dev.azure.com/o/p/_git/alpha',
      'https://dev.azure.com/o/p/_versioncontrol/x'
    ]);
    expect(repos.children.map((child) => child.label)).toEqual([
      'alpha',
      'Other'
    ]);
  });

  it('leaves every other section as a flat list', () => {
    const [boards] = nodesFor(['https://dev.azure.com/o/p/_boards/board']);
    expect(boards.children).toEqual([]);
    expect(boards.tabs).toHaveLength(1);
  });
});
