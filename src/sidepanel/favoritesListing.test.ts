import { buildFavoritesListing } from './favoritesListing';
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

    expect(listing.rows.map((row) => row.label)).toEqual([
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

    expect(listing.rows[0].label).toBe('Frontend board');
    expect(listing.rows[listing.rows.length - 1].label).toBe(
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

    expect(listing.rows.map((row) => row.label)).toEqual([
      'Pinned task',
      '#13 Chase the flaky test'
    ]);
  });
});

describe('buildFavoritesListing, widened search', () => {
  const ALL = [
    { page: page('Team wiki', 'https://wiki.test/team'), folder: 'Work' },
    { page: page('Payroll', 'https://hr.test/payroll'), folder: 'Work' },
    { page: page('Weather', 'https://weather.test/'), folder: 'Daily' }
  ];

  it('groups every bookmark under the folder it lives in, indented', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.', ALL);

    expect(listing.sections.map((s) => [s.label, s.indent])).toEqual([
      ['Work', true],
      ['Daily', true]
    ]);
    expect(listing.rows.map((row) => row.label)).toEqual([
      'Team wiki',
      'Payroll',
      'Weather'
    ]);
  });

  it('orders folders by where their best match landed, not alphabetically', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.weather', ALL);

    expect(listing.sections.map((s) => s.label)).toEqual(['Daily']);
  });

  it('strips the period before matching, so it is a mode and not a term', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.payroll', ALL);

    expect(listing.rows.map((row) => row.label)).toEqual(['Payroll']);
  });

  it('does not repeat the favorites as their own section in that mode', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.', ALL);

    expect(listing.rows).toHaveLength(3);
  });

  it('names a bookmark outside any named folder rather than showing a blank divider', () => {
    const listing = buildFavoritesListing(FAVORITES, QUICK, '.', [
      { page: page('Loose', 'https://loose.test/'), folder: '' }
    ]);

    expect(listing.sections[0].label).toBe('Bookmarks');
  });
});
