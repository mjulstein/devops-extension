import { readAppFolders } from './appGroups';
import {
  buildAppGroups,
  buildOtherGroup,
  claimedTabIds,
  groupFavIconUrl,
  applyKeyOrder,
  moveKeyTo,
  sortTabGroups
} from './tabGroups';
import type { OpenTab } from './adoTabs';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_000 * DAY;

function tab(id: number, url: string, daysOld = 1): OpenTab {
  return { id, url, title: `Tab ${id}`, lastAccessed: now - daysOld * DAY };
}

describe('groupFavIconUrl', () => {
  const group = {
    key: 'g',
    label: 'G',
    tabs: [
      {
        id: 1,
        title: 'old',
        url: 'https://a.test/',
        path: '/',
        lastAccessed: 10,
        windowId: null,
        favIconUrl: 'https://a.test/old.png',
        pinned: false,
        active: false,
        audible: false
      },
      {
        id: 2,
        title: 'new',
        url: 'https://a.test/b',
        path: '/b',
        lastAccessed: 99,
        windowId: null,
        favIconUrl: 'https://a.test/new.png',
        pinned: false,
        active: false,
        audible: false
      }
    ],
    children: []
  };

  it('takes the icon from the newest tab, whatever the display order', () => {
    // The first row changes when the order flips; the newest does not.
    expect(groupFavIconUrl(group)).toBe('https://a.test/new.png');
    expect(groupFavIconUrl(sortTabGroups([group], 'newest')[0])).toBe(
      'https://a.test/new.png'
    );
  });

  it('skips a tab with no icon rather than answering with none', () => {
    expect(
      groupFavIconUrl({
        ...group,
        tabs: [{ ...group.tabs[1], favIconUrl: null }, group.tabs[0]]
      })
    ).toBe('https://a.test/old.png');
  });

  it('looks inside the sub-groups of a narrowed group', () => {
    expect(
      groupFavIconUrl({ key: 'p', label: 'P', tabs: [], children: [group] })
    ).toBe('https://a.test/new.png');
  });

  it('is null when nothing in the group has one', () => {
    expect(
      groupFavIconUrl({ key: 'e', label: 'E', tabs: [], children: [] })
    ).toBeNull();
  });
});

describe('buildOtherGroup', () => {
  const tabs = [
    tab(1, 'https://wiki.example.com/a', 5),
    tab(2, 'https://wiki.example.com/b', 1),
    tab(3, 'https://news.test/story', 2)
  ];

  it('collects what nothing claimed, by host', () => {
    const other = buildOtherGroup(tabs, new Set());
    expect(other?.label).toBe('Other');
    expect(other?.children.map((child) => child.label)).toEqual([
      'news.test',
      'wiki.example.com'
    ]);
  });

  it('offers each host as a group waiting to be made', () => {
    const other = buildOtherGroup(tabs, new Set());
    expect(other?.children[0].promoteDomain).toBe('news.test');
  });

  it('leaves out what a group already holds', () => {
    const other = buildOtherGroup(tabs, new Set([1, 2]));
    expect(other?.children.map((child) => child.label)).toEqual(['news.test']);
  });

  it('is nothing at all when everything is claimed', () => {
    // An empty catch-all is noise, and nobody asked for it to be there.
    expect(buildOtherGroup(tabs, new Set([1, 2, 3]))).toBeNull();
  });

  it('orders a host own tabs oldest first', () => {
    const other = buildOtherGroup(tabs, new Set([3]));
    expect(other?.children[0].tabs.map((entry) => entry.id)).toEqual([1, 2]);
  });
});

describe('claimedTabIds', () => {
  it('counts the tabs of a group and its children', () => {
    const folders = readAppFolders({
      id: 'apps',
      children: [
        {
          id: 'f',
          title: 'example.com',
          children: [
            { id: 'b', title: 'Home', url: 'https://example.com/' },
            {
              id: 'sub',
              title: '*/spaces',
              children: [
                { id: 'b2', title: 'A', url: 'https://example.com/spaces/a' }
              ]
            }
          ]
        }
      ]
    });
    const groups = buildAppGroups(folders, [
      tab(1, 'https://example.com/spaces/a', 1),
      tab(2, 'https://example.com/b', 1)
    ]);
    expect([...claimedTabIds(groups)].sort()).toEqual([1, 2]);
  });
});
describe('applyKeyOrder', () => {
  const groups = ['a', 'b', 'c'].map((key) => ({
    key,
    label: key,
    tabs: [],
    children: []
  }));

  it('draws them in the stored order', () => {
    expect(applyKeyOrder(groups, ['c', 'a', 'b']).map((g) => g.key)).toEqual([
      'c',
      'a',
      'b'
    ]);
  });

  it('leaves the natural order alone when nothing is stored', () => {
    expect(applyKeyOrder(groups, []).map((g) => g.key)).toEqual([
      'a',
      'b',
      'c'
    ]);
  });

  it('puts a key it has never seen after the ones it has', () => {
    // A section that turns up later is added, not hidden.
    expect(applyKeyOrder(groups, ['c']).map((g) => g.key)).toEqual([
      'c',
      'a',
      'b'
    ]);
  });
});

describe('moveKeyTo', () => {
  const keys = ['a', 'b', 'c'];

  it('moves a key to the gap before another', () => {
    expect(moveKeyTo(keys, 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveKeyTo(keys, 'a', 2)).toEqual(['b', 'a', 'c']);
  });

  it('moves a key to the last gap', () => {
    expect(moveKeyTo(keys, 'a', 3)).toEqual(['b', 'c', 'a']);
  });

  it('changes nothing when dropped into its own gaps', () => {
    // Either side of where it already is leaves it where it already is.
    expect(moveKeyTo(keys, 'b', 1)).toEqual(['a', 'b', 'c']);
    expect(moveKeyTo(keys, 'b', 2)).toEqual(['a', 'b', 'c']);
  });

  it('ignores a key that is not in the list', () => {
    expect(moveKeyTo(keys, 'zzz', 0)).toBe(keys);
  });
});

describe('buildAppGroups', () => {
  const folders = readAppFolders({
    id: 'apps',
    children: [
      {
        id: 'f1',
        title: 'example.com',
        children: [
          { id: 'b1', title: 'Home', url: 'https://example.com/' },
          { id: 'b2', title: 'Report', url: 'https://example.com/report' }
        ]
      },
      { id: 'f2', title: 'sub.example.com', children: [] }
    ]
  });

  it('makes one flat group per folder', () => {
    const groups = buildAppGroups(folders, []);
    expect(groups.map((group) => group.label)).toEqual([
      'example.com',
      'sub.example.com'
    ]);
    expect(groups[0].children).toEqual([]);
  });

  it('keeps a bookmark with nothing open as a row that opens one', () => {
    const [group] = buildAppGroups(folders, []);
    expect(group.bookmarks?.map((b) => b.name)).toEqual(['Home', 'Report']);
  });

  it('drops a bookmark once a tab is open at its address, query and all', () => {
    const [group] = buildAppGroups(folders, [
      tab(1, 'https://example.com/report?from=2026', 1)
    ]);
    expect(group.bookmarks?.map((b) => b.name)).toEqual(['Home']);
    expect(group.tabs.map((t) => t.id)).toEqual([1]);
  });

  it('gives a tab to the more specific host, not to both', () => {
    // A folder named for a sub-domain exists to separate it out; counting the
    // tab twice would make both groups lie.
    const groups = buildAppGroups(folders, [
      tab(1, 'https://sub.example.com/x', 1),
      tab(2, 'https://example.com/y', 2)
    ]);
    expect(groups[0].tabs.map((t) => t.id)).toEqual([2]);
    expect(groups[1].tabs.map((t) => t.id)).toEqual([1]);
  });

  it('leaves a tab from another domain alone', () => {
    const groups = buildAppGroups(folders, [tab(1, 'https://other.org/', 1)]);
    expect(groups.every((group) => group.tabs.length === 0)).toBe(true);
  });
});
