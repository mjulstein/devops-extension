import { carryPathAcrossEnvironments, isSamePage } from './envSwitch';
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
