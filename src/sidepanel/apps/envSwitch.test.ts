import {
  carryPathAcrossEnvironments,
  identifyEnvironment,
  isSamePage,
  orderEnvironmentsForSwitching,
  usageFromTabs
} from './envSwitch';
import type { AppEntry } from './appDns';

const app: AppEntry = {
  name: 'my-app',
  environments: [
    { name: 'env1', url: 'https://env1.my-app.com/' },
    { name: 'env2', url: 'https://env2.my-app.com/' }
  ]
};

describe('carryPathAcrossEnvironments', () => {
  it('keeps the path and query, changing only the host', () => {
    expect(
      carryPathAcrossEnvironments(
        app,
        'https://env2.my-app.com/',
        'https://env1.my-app.com/some/path?x=1'
      )
    ).toBe('https://env2.my-app.com/some/path?x=1');
  });

  it('carries the fragment too', () => {
    expect(
      carryPathAcrossEnvironments(
        app,
        'https://env2.my-app.com/',
        'https://env1.my-app.com/a#b'
      )
    ).toBe('https://env2.my-app.com/a#b');
  });

  it('leaves the target alone when standing on another site', () => {
    expect(
      carryPathAcrossEnvironments(
        app,
        'https://env2.my-app.com/',
        'https://example.test/deep/path'
      )
    ).toBe('https://env2.my-app.com/');
  });

  it('leaves the target alone when there is nothing to carry', () => {
    expect(
      carryPathAcrossEnvironments(
        app,
        'https://env2.my-app.com/dashboard',
        'https://env1.my-app.com/'
      )
    ).toBe('https://env2.my-app.com/dashboard');
  });

  it('leaves the target alone when it is the environment you are already on', () => {
    expect(
      carryPathAcrossEnvironments(
        app,
        'https://env1.my-app.com/',
        'https://env1.my-app.com/some/path'
      )
    ).toBe('https://env1.my-app.com/');
  });

  it('carries onto an address the app has no bookmark for yet', () => {
    // A suggested environment is still this app's; only the page you are
    // standing on has to be recognised.
    expect(
      carryPathAcrossEnvironments(
        app,
        'https://env3.my-app.com/',
        'https://env1.my-app.com/some/path'
      )
    ).toBe('https://env3.my-app.com/some/path');
  });

  it('copes with no current page at all', () => {
    expect(
      carryPathAcrossEnvironments(app, 'https://env2.my-app.com/', null)
    ).toBe('https://env2.my-app.com/');
  });
});

describe('isSamePage', () => {
  it('counts the query', () => {
    expect(isSamePage('https://a.test/p?x=1', 'https://a.test/p?x=1')).toBe(
      true
    );
    expect(isSamePage('https://a.test/p?x=1', 'https://a.test/p?x=2')).toBe(
      false
    );
  });

  it('ignores the fragment and a trailing slash', () => {
    expect(isSamePage('https://a.test/p/', 'https://a.test/p#frag')).toBe(true);
  });

  it('separates two hosts', () => {
    expect(isSamePage('https://a.test/p', 'https://b.test/p')).toBe(false);
  });
});

describe('identifyEnvironment', () => {
  it('says which environment a page is in, by its host', () => {
    expect(
      identifyEnvironment(app, 'https://env2.my-app.com/deep/path?x=1')?.name
    ).toBe('env2');
  });

  it('matches a bookmark that still carries a path of its own', () => {
    const uncleaned: AppEntry = {
      name: 'my-app',
      environments: [
        { name: 'uat', url: 'https://uat.my-app.com/some/page?a=1' }
      ]
    };
    expect(
      identifyEnvironment(uncleaned, 'https://uat.my-app.com/elsewhere')?.name
    ).toBe('uat');
  });

  it('is null for a page outside the app', () => {
    expect(identifyEnvironment(app, 'https://example.test/')).toBeNull();
    expect(identifyEnvironment(app, null)).toBeNull();
  });
});

describe('switching from a bookmark that has not been cleaned', () => {
  it('takes only the origin from the target', () => {
    const uncleaned: AppEntry = {
      name: 'my-app',
      environments: [
        { name: 'env1', url: 'https://env1.my-app.com/' },
        { name: 'env2', url: 'https://env2.my-app.com/left/over?stale=1' }
      ]
    };
    expect(
      carryPathAcrossEnvironments(
        uncleaned,
        'https://env2.my-app.com/left/over?stale=1',
        'https://env1.my-app.com/some/path?x=1'
      )
    ).toBe('https://env2.my-app.com/some/path?x=1');
  });
});

describe('orderEnvironmentsForSwitching', () => {
  const three = [
    { name: 'a', url: 'https://a.my-app.com/' },
    { name: 'b', url: 'https://b.my-app.com/' },
    { name: 'c', url: 'https://c.my-app.com/' }
  ];

  it('leads with the one used most recently', () => {
    const order = orderEnvironmentsForSwitching(
      three,
      { 'b.my-app.com': 200, 'c.my-app.com': 100 },
      null
    );
    expect(order.map((e) => e.name)).toEqual(['b', 'c', 'a']);
  });

  it('puts the one you are looking at last', () => {
    const order = orderEnvironmentsForSwitching(
      three,
      { 'b.my-app.com': 200, 'a.my-app.com': 300 },
      'a.my-app.com'
    );
    expect(order.map((e) => e.name)).toEqual(['b', 'c', 'a']);
  });

  it('makes two environments a flip between them', () => {
    // On a, with b the other open tab: b is the first row, so Enter goes back.
    const pair = three.slice(0, 2);
    expect(
      orderEnvironmentsForSwitching(
        pair,
        { 'a.my-app.com': 300, 'b.my-app.com': 200 },
        'a.my-app.com'
      ).map((e) => e.name)
    ).toEqual(['b', 'a']);
  });

  it('keeps folder order among environments with no tab open', () => {
    expect(
      orderEnvironmentsForSwitching(three, {}, null).map((e) => e.name)
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('usageFromTabs', () => {
  it('keeps the most recent access for each host', () => {
    expect(
      usageFromTabs([
        { url: 'https://a.test/one', lastAccessed: 10 },
        { url: 'https://a.test/two', lastAccessed: 50 },
        { url: 'https://b.test/', lastAccessed: 20 }
      ])
    ).toEqual({ 'a.test': 50, 'b.test': 20 });
  });

  it('skips tabs with nothing to go on', () => {
    expect(
      usageFromTabs([{ url: 'https://a.test/' }, { lastAccessed: 1 }])
    ).toEqual({});
  });
});
