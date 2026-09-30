import {
  appRowTarget,
  buildFavoritesListing,
  rowDetail,
  rowLabel
} from '../favoritesListing';
import type { AppEntry } from './appDns';

const apps: AppEntry[] = [
  {
    name: 'my-app',
    environments: [
      { name: 'live', url: 'https://my-app.orgname.com/' },
      { name: 'test', url: 'https://my-app-test.orgname.com/' }
    ]
  }
];

const favorite = {
  url: 'https://dev.azure.com/o/p/_boards',
  label: 'Board',
  starredAt: 1
};

describe('apps in the favorites listing', () => {
  it('gives an app one row however many environments it has', () => {
    const listing = buildFavoritesListing([favorite], [], '', undefined, apps);
    const appRows = listing.rows.filter((row) => row.kind === 'app');
    expect(appRows).toHaveLength(1);
    expect(rowLabel(appRows[0])).toBe('my-app');
  });

  it('keeps the apps behind their own divider, below the favorites', () => {
    const listing = buildFavoritesListing([favorite], [], '', undefined, apps);
    expect(listing.sections.map((section) => section.label)).toEqual([
      null,
      'Apps'
    ]);
  });

  it('points a fresh row at the first environment', () => {
    const listing = buildFavoritesListing([], [], 'my-app', undefined, apps);
    expect(rowDetail(listing.rows[0])).toBe(
      'live · https://my-app.orgname.com/'
    );
  });

  it('steps through the environments as Tab is pressed', () => {
    const listing = buildFavoritesListing([], [], 'my-app', undefined, apps);
    expect(appRowTarget(listing.rows[0], 1)?.environment.name).toBe('test');
    expect(appRowTarget(listing.rows[0], 2)?.environment.name).toBe('live');
  });

  it('aims at the environment named in the search', () => {
    const listing = buildFavoritesListing(
      [],
      [],
      'my-app test',
      undefined,
      apps
    );
    expect(rowDetail(listing.rows[0])).toBe(
      'test · https://my-app-test.orgname.com/'
    );
  });

  it('marks an address it had to work out as suggested', () => {
    const listing = buildFavoritesListing(
      [],
      [],
      'my-app staging',
      undefined,
      apps
    );
    expect(rowDetail(listing.rows[0])).toBe(
      'staging · https://my-app-staging.orgname.com/ · suggested'
    );
  });

  it('says so rather than going nowhere for an app with no environments', () => {
    const listing = buildFavoritesListing([], [], 'empty', undefined, [
      { name: 'empty', environments: [] }
    ]);
    expect(rowDetail(listing.rows[0])).toBe('No environments yet');
    expect(appRowTarget(listing.rows[0])).toBeNull();
  });

  it('leaves the listing alone when there are no apps', () => {
    const listing = buildFavoritesListing([favorite], [], '');
    expect(listing.rows.every((row) => row.kind !== 'app')).toBe(true);
  });
});

describe('walking into the apps with the - prefix', () => {
  const two: AppEntry[] = [
    ...apps,
    {
      name: 'other-app',
      environments: [{ name: 'live', url: 'https://other-app.com/' }]
    }
  ];

  it('offers the apps themselves with nothing named', () => {
    const listing = buildFavoritesListing([], [], '-', undefined, two);
    expect(listing.rows.map((row) => row.kind)).toEqual([
      'app-folder',
      'app-folder'
    ]);
    expect(listing.rows.map(rowLabel)).toEqual(['my-app', 'other-app']);
    expect(rowDetail(listing.rows[0])).toBe('2 environments');
  });

  it('walks in as soon as the typing names an app', () => {
    // No second keystroke to enter it: naming the app is asking for it, the
    // same as typing a bookmark folder's name in a widened search.
    const listing = buildFavoritesListing([], [], '-other', undefined, two);
    expect(listing.sections.map((section) => section.label)).toEqual([
      'other-app'
    ]);
    expect(listing.rows.map(rowLabel)).toEqual(['live']);
  });

  it('shows every app a partial name matches, each under its own heading', () => {
    const listing = buildFavoritesListing([], [], '-app', undefined, two);
    expect(listing.sections.map((section) => section.label)).toEqual([
      'my-app',
      'other-app'
    ]);
  });

  it('lists the environments inside a named app, under its name', () => {
    const listing = buildFavoritesListing([], [], '-my-app ', undefined, two);
    expect(listing.sections.map((section) => section.label)).toEqual(['my-app']);
    expect(listing.sections[0].indent).toBe(true);
    expect(listing.rows.map(rowLabel)).toEqual(['live', 'test']);
    expect(rowDetail(listing.rows[0])).toBe('https://my-app.orgname.com/');
  });

  it('filters the environments by the word after the app', () => {
    const listing = buildFavoritesListing([], [], '-my-app te', undefined, two);
    expect(listing.rows.map(rowLabel)).toEqual(['test']);
  });

  it('shows the app rather than an empty list when nothing inside matches', () => {
    const listing = buildFavoritesListing([], [], '-my-app zzz', undefined, two);
    expect(listing.rows.map((row) => row.kind)).toEqual(['app-folder']);
  });

  it('says so for an app with nothing in it yet', () => {
    const listing = buildFavoritesListing([], [], '-', undefined, [
      { name: 'empty', environments: [] }
    ]);
    expect(rowDetail(listing.rows[0])).toBe('No environments yet');
  });
});
