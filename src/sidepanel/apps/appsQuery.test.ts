import {
  matchApps,
  matchEnvironmentIndex,
  parseAppQuery,
  resolveAppTarget
} from './appsQuery';
import type { AppEntry } from './appDns';

const apps: AppEntry[] = [
  {
    name: 'my-app',
    environments: [
      { name: 'live', url: 'https://my-app.orgname.com/' },
      { name: 'test', url: 'https://my-app-test.orgname.com/' },
      { name: 'dev', url: 'https://myapp-dev.orgname.com/' }
    ]
  },
  {
    name: 'other app',
    environments: [{ name: 'live', url: 'https://other.com/' }]
  }
];

describe('parseAppQuery', () => {
  it('treats a name that matches an app as the whole app term', () => {
    expect(parseAppQuery('my-app', apps)).toEqual({
      appTerm: 'my-app',
      envTerm: null
    });
  });

  it('keeps a half-typed name whole rather than splitting it', () => {
    expect(parseAppQuery('my-a', apps)).toEqual({
      appTerm: 'my-a',
      envTerm: null
    });
  });

  it('takes the last word as the environment once the app is named', () => {
    expect(parseAppQuery('my-app test', apps)).toEqual({
      appTerm: 'my-app',
      envTerm: 'test'
    });
  });

  it('handles an app whose own name has a space', () => {
    // 'other app' matches whole, so it is not read as app 'other' env 'app'.
    expect(parseAppQuery('other app', apps)).toEqual({
      appTerm: 'other app',
      envTerm: null
    });
    expect(parseAppQuery('other app live', apps)).toEqual({
      appTerm: 'other app',
      envTerm: 'live'
    });
  });
});

describe('matchApps', () => {
  it('puts a name that starts with the term first', () => {
    expect(matchApps(apps, 'o').map((app) => app.name)).toEqual(['other app']);
    expect(matchApps(apps, 'app').map((app) => app.name)).toEqual([
      'my-app',
      'other app'
    ]);
  });

  it('returns everything for an empty term, in folder order', () => {
    expect(matchApps(apps, '').map((app) => app.name)).toEqual([
      'my-app',
      'other app'
    ]);
  });
});

describe('matchEnvironmentIndex', () => {
  it('matches a name exactly before matching a prefix', () => {
    expect(matchEnvironmentIndex(apps[0], 'test')).toBe(1);
    expect(matchEnvironmentIndex(apps[0], 'de')).toBe(2);
  });

  it('is -1 for a name this app has never been given', () => {
    expect(matchEnvironmentIndex(apps[0], 'staging')).toBe(-1);
  });
});

describe('resolveAppTarget', () => {
  it('points at the first environment with nothing typed', () => {
    const target = resolveAppTarget(apps[0], null);
    expect(target?.environment.name).toBe('live');
    expect(target?.index).toBe(0);
    expect(target?.isDerived).toBe(false);
  });

  it('steps through the environments in folder order, and wraps', () => {
    const names = [0, 1, 2, 3].map(
      (step) => resolveAppTarget(apps[0], null, step)?.environment.name
    );
    expect(names).toEqual(['live', 'test', 'dev', 'live']);
  });

  it('honours an address that does not follow the pattern', () => {
    // dev is myapp-dev, not my-app-dev. Stored beats derived, always.
    expect(resolveAppTarget(apps[0], 'dev')?.environment.url).toBe(
      'https://myapp-dev.orgname.com/'
    );
  });

  it('suggests an address for an environment it has never been given', () => {
    const target = resolveAppTarget(apps[0], 'staging');
    expect(target?.environment.url).toBe('https://my-app-staging.orgname.com/');
    expect(target?.isDerived).toBe(true);
    expect(target?.index).toBe(-1);
  });

  it('steps from a typed environment rather than from the top', () => {
    expect(resolveAppTarget(apps[0], 'test', 1)?.environment.name).toBe('dev');
  });

  it('steps off a suggestion onto the stored environments', () => {
    expect(resolveAppTarget(apps[0], 'staging', 1)?.environment.name).toBe(
      'live'
    );
  });

  it('has nothing to point at for an app with no environments', () => {
    expect(
      resolveAppTarget({ name: 'empty', environments: [] }, null)
    ).toBeNull();
  });
});
