import { buildFavoritesListing, rowLabel } from './favoritesListing';
import type { StarredPage } from './starredPages';

function page(label: string, url: string): StarredPage {
  return { label, url, starredAt: 1 };
}

const FAVORITES = [
  page('Frontend board', 'https://dev.azure.test/org/proj/_boards/Frontend'),
  page('Dashboards', 'https://dev.azure.test/org/proj/_dashboards')
];

const QUICK = [
  page(
    '#12 Fix the board filter',
    'https://dev.azure.test/org/proj/_workitems/edit/12'
  ),
  page(
    '#13 Chase the flaky test',
    'https://dev.azure.test/org/proj/_workitems/edit/13'
  )
];

describe('buildFavoritesListing', () => {
  it('puts chosen favorites above open quick tasks, under a divider', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '');

    expect(listing.rows.map(rowLabel)).toEqual([
      'Frontend board',
      'Dashboards',
      '#12 Fix the board filter',
      '#13 Chase the flaky test'
    ]);
    expect(listing.sections.map((s) => [s.label, s.startIndex])).toEqual([
      [null, 0],
      ['Quick tasks', 2]
    ]);
  });

  it('keeps quick tasks last even when they match the search better', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, 'board');

    expect(rowLabel(listing.rows[0])).toBe('Frontend board');
    expect(rowLabel(listing.rows[listing.rows.length - 1])).toBe(
      '#12 Fix the board filter'
    );
  });

  it('drops a section with nothing in it rather than showing an empty divider', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, 'dashboards');

    expect(listing.sections).toHaveLength(1);
    expect(listing.sections[0].label).toBeNull();
  });

  it('shows a quick task that is also a favorite only once, as the favorite', () => {
    const shared = page('Pinned task', QUICK[0].url);
    const listing = buildFavoritesListing([shared], QUICK, '');

    expect(listing.rows.map(rowLabel)).toEqual([
      'Pinned task',
      '#13 Chase the flaky test'
    ]);
  });
});

describe('buildFavoritesListing, widened search', () => {
  const BOOKMARKS = [
    { page: page('Team wiki', 'https://wiki.test/team'), folder: 'Work' },
    { page: page('Payroll', 'https://hr.test/payroll'), folder: 'Work' },
    { page: page('Weather', 'https://weather.test/'), folder: 'Daily' }
  ];
  const FOLDERS = [
    { id: 'w', title: 'Work', path: 'Bookmarks bar', count: 2 },
    { id: 'd', title: 'Daily', path: 'Bookmarks bar', count: 1 }
  ];
  const ALL = { bookmarks: BOOKMARKS, folders: FOLDERS };

  it('offers the folders when nothing is typed, rather than every bookmark', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.', {
      bookmarks: [],
      folders: FOLDERS
    });

    expect(listing.sections.map((s) => s.label)).toEqual(['Folders']);
    expect(listing.rows.map(rowLabel)).toEqual(['Work', 'Daily']);
    expect(listing.rows.every((row) => row.kind === 'folder')).toBe(true);
  });

  it('groups matched bookmarks under the folder each lives in, indented', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.e', ALL);

    expect(listing.sections.map((s) => [s.label, s.indent])).toEqual([
      ['Folders', false],
      ['Work', true],
      ['Daily', true]
    ]);
  });

  it('orders bookmark groups by where their best match landed, not alphabetically', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.weather', {
      bookmarks: BOOKMARKS,
      folders: []
    });

    expect(listing.sections.map((s) => s.label)).toEqual(['Daily']);
  });

  it('strips the period before matching, so it is a mode and not a term', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.payroll', {
      bookmarks: BOOKMARKS,
      folders: []
    });

    expect(listing.rows.map(rowLabel)).toEqual(['Payroll']);
  });

  it('does not repeat the favorites as their own section in that mode', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.', ALL);

    expect(listing.rows.some((row) => rowLabel(row) === 'Frontend board')).toBe(
      false
    );
  });

  it('names a bookmark outside any named folder rather than showing a blank divider', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.loose', {
      bookmarks: [{ page: page('Loose', 'https://loose.test/'), folder: '' }],
      folders: []
    });

    expect(listing.sections[0].label).toBe('Bookmarks');
  });
});

describe('buildFavoritesListing, matching a folder by name', () => {
  const FOLDERS = [{ id: 'w', title: 'Work', path: '', count: 2 }];

  it('shows everything inside a matched folder, not just what repeats its name', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.work', {
      folders: FOLDERS,
      bookmarks: [
        {
          page: page('Team wiki', 'https://wiki.test/team'),
          folder: 'Work',
          viaFolder: true
        },
        {
          page: page('Payroll', 'https://hr.test/payroll'),
          folder: 'Work',
          viaFolder: true
        }
      ]
    });

    expect(listing.rows.map(rowLabel)).toEqual([
      'Work',
      'Team wiki',
      'Payroll'
    ]);
  });

  it('still requires a title or address match of anything not in that folder', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.work', {
      folders: FOLDERS,
      bookmarks: [
        {
          page: page('Team wiki', 'https://wiki.test/team'),
          folder: 'Work',
          viaFolder: true
        },
        { page: page('Weather', 'https://weather.test/'), folder: 'Daily' }
      ]
    });

    expect(listing.rows.map(rowLabel)).toEqual(['Work', 'Team wiki']);
  });

  it('lists a bookmark once when it both matches and sits in a matched folder', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.work', {
      folders: FOLDERS,
      bookmarks: [
        {
          page: page('Work notes', 'https://notes.test/'),
          folder: 'Work',
          viaFolder: true
        },
        { page: page('Work notes', 'https://notes.test/'), folder: 'Work' }
      ]
    });

    expect(listing.rows.map(rowLabel)).toEqual(['Work', 'Work notes']);
  });
});
