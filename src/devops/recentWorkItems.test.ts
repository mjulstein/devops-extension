import {
  buildWorkItemUrl,
  matchRecentWorkItems,
  parseWorkItemQuery,
  recordRecentWorkItem,
  type RecentWorkItem
} from './recentWorkItems';
import {
  buildFavoritesListing,
  rowDetail,
  rowLabel
} from '@/sidepanel/favoritesListing';

function item(id: number, title: string, at = id): RecentWorkItem {
  return {
    id,
    title,
    url: `https://dev.azure.test/o/p/_workitems/edit/${id}`,
    at
  };
}

describe('recordRecentWorkItem', () => {
  it('puts the newest first', () => {
    const list = recordRecentWorkItem([item(1, 'One')], item(2, 'Two'));
    expect(list.map((entry) => entry.id)).toEqual([2, 1]);
  });

  it('moves a revisited item up rather than repeating it', () => {
    const list = recordRecentWorkItem(
      [item(1, 'One'), item(2, 'Two')],
      item(2, 'Two')
    );
    expect(list.map((entry) => entry.id)).toEqual([2, 1]);
  });

  it('corrects a title that has changed', () => {
    const list = recordRecentWorkItem([item(1, 'Old')], item(1, 'New'));
    expect(list[0].title).toBe('New');
  });

  it('keeps the title it had when the new one is empty', () => {
    // A stale heading reads better than a blank one.
    const list = recordRecentWorkItem([item(1, 'Known')], item(1, '  '));
    expect(list[0].title).toBe('Known');
  });

  it('forgets the oldest past the limit', () => {
    const list = recordRecentWorkItem(
      [item(1, 'One'), item(2, 'Two')],
      item(3, 'Three'),
      2
    );
    expect(list.map((entry) => entry.id)).toEqual([3, 1]);
  });
});

describe('parseWorkItemQuery', () => {
  it('reads a number as both an item to open and a filter', () => {
    expect(parseWorkItemQuery('12345')).toEqual({ id: 12345, filter: '12345' });
  });

  it('reads anything else as a filter only', () => {
    expect(parseWorkItemQuery(' some title ')).toEqual({
      id: null,
      filter: 'some title'
    });
  });

  it('reads nothing typed as no filter at all', () => {
    expect(parseWorkItemQuery('  ')).toEqual({ id: null, filter: '' });
  });
});

describe('matchRecentWorkItems', () => {
  const list = [item(101, 'Fix the login page'), item(222, 'Add a report')];

  it('returns everything for an empty filter', () => {
    expect(matchRecentWorkItems(list, '')).toHaveLength(2);
  });

  it('matches on the title, case-insensitively', () => {
    expect(matchRecentWorkItems(list, 'LOGIN').map((e) => e.id)).toEqual([101]);
  });

  it('matches on part of the number', () => {
    expect(matchRecentWorkItems(list, '22').map((e) => e.id)).toEqual([222]);
  });
});

describe('buildWorkItemUrl', () => {
  it('builds from the organization and project it is given', () => {
    expect(buildWorkItemUrl('my-org', 'my project', 77)).toBe(
      'https://dev.azure.com/my-org/my%20project/_workitems/edit/77'
    );
  });

  it('refuses when there is no organization or project to use', () => {
    expect(buildWorkItemUrl('', 'p', 1)).toBeNull();
    expect(buildWorkItemUrl('o', '  ', 1)).toBeNull();
  });
});

describe('the # listing', () => {
  const recent = [item(101, 'Fix the login page'), item(222, 'Add a report')];

  it('offers everything recent for a bare #', () => {
    const listing = buildFavoritesListing(
      [],
      [],
      '#',
      undefined,
      [],
      undefined,
      recent
    );
    expect(listing.sections.map((s) => s.label)).toEqual(['Recent work items']);
    expect(listing.rows.map(rowLabel)).toEqual([
      'Fix the login page',
      'Add a report'
    ]);
  });

  it('leads with the number typed, even when it has never been visited', () => {
    const listing = buildFavoritesListing(
      [],
      [],
      '#999',
      undefined,
      [],
      undefined,
      recent
    );
    expect(rowLabel(listing.rows[0])).toBe('Work item 999');
    expect(rowDetail(listing.rows[0])).toBe('Open #999');
  });

  it('does not offer a typed number twice when it is also recent', () => {
    const listing = buildFavoritesListing(
      [],
      [],
      '#101',
      undefined,
      [],
      undefined,
      recent
    );
    expect(listing.rows.map(rowLabel)).toEqual(['Fix the login page']);
  });

  it('filters the list by what follows the #', () => {
    const listing = buildFavoritesListing(
      [],
      [],
      '# login',
      undefined,
      [],
      undefined,
      recent
    );
    expect(listing.rows.map(rowLabel)).toEqual(['Fix the login page']);
  });

  it('is empty, not broken, with nothing visited yet', () => {
    const listing = buildFavoritesListing(
      [],
      [],
      '#',
      undefined,
      [],
      undefined,
      []
    );
    expect(listing.rows).toEqual([]);
  });
});
