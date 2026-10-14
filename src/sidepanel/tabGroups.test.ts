import {
  buildTabGroups,
  createTabGroup,
  groupFavIconUrl,
  hostMatchesDomain,
  matchTarget,
  sortTabGroups,
  type TabGroupSetting
} from './tabGroups';
import type { OpenTab } from './adoTabs';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_000 * DAY;

function tab(id: number, url: string, daysOld = 1): OpenTab {
  return { id, url, title: `Tab ${id}`, lastAccessed: now - daysOld * DAY };
}

describe('hostMatchesDomain', () => {
  it('matches the domain itself and anything under it', () => {
    expect(hostMatchesDomain('example.com', 'example.com')).toBe(true);
    expect(hostMatchesDomain('wiki.example.com', 'example.com')).toBe(true);
  });

  it('does not match a domain that merely ends the same way', () => {
    expect(hostMatchesDomain('notexample.com', 'example.com')).toBe(false);
  });

  it('ignores a leading dot and empty input', () => {
    expect(hostMatchesDomain('wiki.example.com', '.example.com')).toBe(true);
    expect(hostMatchesDomain('example.com', '  ')).toBe(false);
  });
});

describe('createTabGroup', () => {
  it('takes a domain as typed, however it was typed', () => {
    expect(createTabGroup(' https://Wiki.Example.com/spaces ')).toEqual({
      domain: 'wiki.example.com',
      label: 'wiki.example.com',
      rules: []
    });
  });
});

describe('matchTarget', () => {
  it('is the host and path together, so one rule covers both', () => {
    expect(matchTarget('https://wiki.example.com/spaces/ABC?x=1')).toBe(
      'wiki.example.com/spaces/abc?x=1'
    );
  });
});

describe('buildTabGroups', () => {
  const tabs = [
    tab(1, 'https://wiki.example.com/spaces/ABC', 5),
    tab(2, 'https://wiki.example.com/pages/123', 2),
    tab(3, 'https://jira.example.com/browse/X-1', 1),
    tab(4, 'https://elsewhere.test/', 1)
  ];

  it('collects a domain with no rules into one group', () => {
    const groups = buildTabGroups(tabs, [createTabGroup('example.com')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].children).toEqual([]);
    expect(groups[0].tabs.map((entry) => entry.id)).toEqual([1, 2, 3]);
  });

  it('orders a group oldest first, then by address', () => {
    const groups = buildTabGroups(tabs, [createTabGroup('example.com')]);
    expect(groups[0].tabs.map((entry) => entry.id)).toEqual([1, 2, 3]);
  });

  it('splits a group by its rules, first match winning', () => {
    const setting: TabGroupSetting = {
      domain: 'example.com',
      label: 'Confluence',
      rules: [
        { label: 'Spaces', match: '/spaces/' },
        { label: 'Pages', match: '/pages/' }
      ]
    };
    const [group] = buildTabGroups(tabs, [setting]);
    expect(group.label).toBe('Confluence');
    expect(group.tabs).toEqual([]);
    expect(group.children.map((child) => child.label)).toEqual([
      'Spaces',
      'Pages',
      'Other'
    ]);
    expect(group.children[0].tabs.map((entry) => entry.id)).toEqual([1]);
  });

  it('puts what matched no rule in Other rather than dropping it', () => {
    // Dropping it would make the group quietly lie about what is open.
    const [group] = buildTabGroups(tabs, [
      {
        domain: 'example.com',
        label: 'Confluence',
        rules: [{ label: 'Spaces', match: '/spaces/' }]
      }
    ]);
    const other = group.children.find((child) => child.label === 'Other');
    expect(other?.tabs.map((entry) => entry.id)).toEqual([2, 3]);
  });

  it('narrows by sub-domain with the same one field', () => {
    const [group] = buildTabGroups(tabs, [
      {
        domain: 'example.com',
        label: 'Example',
        rules: [{ label: 'Wiki', match: 'wiki.example.com' }]
      }
    ]);
    expect(group.children[0].tabs.map((entry) => entry.id)).toEqual([1, 2]);
  });

  it('leaves out a sub-group and a group with nothing open', () => {
    const groups = buildTabGroups(tabs, [
      {
        domain: 'example.com',
        label: 'Example',
        rules: [
          { label: 'Spaces', match: '/spaces/' },
          { label: 'Nothing', match: '/never/' }
        ]
      },
      createTabGroup('absent.test')
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].children.map((child) => child.label)).toEqual([
      'Spaces',
      'Other'
    ]);
  });

  it('ignores a rule with nothing to match on', () => {
    const [group] = buildTabGroups(tabs, [
      {
        domain: 'example.com',
        label: 'Example',
        rules: [{ label: 'Blank', match: '  ' }]
      }
    ]);
    expect(group.children).toEqual([]);
    expect(group.tabs).toHaveLength(3);
  });
});

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

describe('sortTabGroups', () => {
  const groups = buildTabGroups(
    [tab(1, 'https://example.com/a', 5), tab(2, 'https://example.com/b', 1)],
    [createTabGroup('example.com')]
  );

  it('leaves the oldest-first order alone', () => {
    expect(sortTabGroups(groups, 'oldest')[0].tabs.map((t) => t.id)).toEqual([
      1, 2
    ]);
  });

  it('turns it round for newest first', () => {
    expect(sortTabGroups(groups, 'newest')[0].tabs.map((t) => t.id)).toEqual([
      2, 1
    ]);
  });

  it('turns the sub-groups round too', () => {
    const narrowed = buildTabGroups(
      [
        tab(1, 'https://example.com/spaces/a', 5),
        tab(2, 'https://example.com/spaces/b', 1)
      ],
      [
        {
          domain: 'example.com',
          label: 'Example',
          rules: [{ label: 'Spaces', match: '/spaces/' }]
        }
      ]
    );
    expect(
      sortTabGroups(narrowed, 'newest')[0].children[0].tabs.map((t) => t.id)
    ).toEqual([2, 1]);
  });
});
