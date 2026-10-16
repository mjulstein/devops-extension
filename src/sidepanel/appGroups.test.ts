import {
  commonDomain,
  commonPathPrefix,
  deriveFolderScope,
  describeScopeViolation,
  scopeMatches,
  type AppBookmark
} from './appGroups';

function mark(id: string, url: string): AppBookmark {
  return { id, name: id, url };
}

describe('commonDomain', () => {
  it('reads what the hosts share, from the right', () => {
    expect(commonDomain(['test.my-app.com', 'my-app.com'])).toBe('my-app.com');
    expect(commonDomain(['a.example.com', 'b.example.com'])).toBe(
      'example.com'
    );
  });

  it('is the host itself when there is only one', () => {
    expect(commonDomain(['my-app.com'])).toBe('my-app.com');
  });

  it('is what little they share when they share little', () => {
    expect(commonDomain(['a.test', 'b.test'])).toBe('test');
  });

  it('is nothing when they share nothing', () => {
    expect(commonDomain(['example.com', 'example.org'])).toBe('');
    expect(commonDomain([])).toBe('');
  });
});

describe('commonPathPrefix', () => {
  it('reads what the paths share, by segment', () => {
    expect(commonPathPrefix(['/spaces/a', '/spaces/b'])).toBe('/spaces');
  });

  it('does not split a segment in half', () => {
    // /spaces and /spacesuit share nothing: a half-segment scope would sweep
    // in pages with no business in the group.
    expect(commonPathPrefix(['/spaces', '/spacesuit'])).toBe('');
  });

  it('is nothing when they diverge at the first segment', () => {
    expect(commonPathPrefix(['/a', '/b'])).toBe('');
  });
});

describe('deriveFolderScope', () => {
  it('reads the domain, the host and the path out of what is inside', () => {
    expect(
      deriveFolderScope([
        mark('a', 'https://wiki.example.com/spaces/a'),
        mark('b', 'https://wiki.example.com/spaces/b')
      ])
    ).toEqual({
      domain: 'wiki.example.com',
      host: 'wiki.example.com',
      path: '/spaces'
    });
  });

  it('leaves the host empty when they are different sub-domains', () => {
    expect(
      deriveFolderScope([
        mark('a', 'https://test.example.com/'),
        mark('b', 'https://live.example.com/')
      ])
    ).toMatchObject({ domain: 'example.com', host: '' });
  });

  it('covers nothing for an empty folder', () => {
    // It has said nothing about itself; a scope from its name is a guess
    // nobody made.
    expect(deriveFolderScope([])).toEqual({ domain: '', host: '', path: '' });
  });
});

describe('scopeMatches', () => {
  const scope = { domain: 'example.com', host: '', path: '/spaces' };

  it('takes an address under the domain and inside the path', () => {
    expect(scopeMatches('https://wiki.example.com/spaces/x', scope)).toBe(true);
    expect(scopeMatches('https://example.com/spaces', scope)).toBe(true);
  });

  it('refuses another domain, and another path', () => {
    expect(scopeMatches('https://other.org/spaces', scope)).toBe(false);
    expect(scopeMatches('https://example.com/pages', scope)).toBe(false);
  });

  it('does not match a path that merely starts the same way', () => {
    expect(scopeMatches('https://example.com/spacesuit', scope)).toBe(false);
  });

  it('matches anything under the domain when no path is shared', () => {
    expect(
      scopeMatches('https://anything.example.com/whatever', {
        domain: 'example.com',
        host: '',
        path: ''
      })
    ).toBe(true);
  });

  it('matches nothing for a scope that covers nothing', () => {
    expect(
      scopeMatches('https://example.com/', { domain: '', host: '', path: '' })
    ).toBe(false);
  });
});

describe('describeScopeViolation', () => {
  const scope = { domain: 'example.com', host: '', path: '/spaces' };

  it('says nothing for an address that belongs', () => {
    expect(describeScopeViolation('https://example.com/spaces/a', scope)).toBe(
      null
    );
  });

  it('names the domain when the address is from somewhere else', () => {
    expect(describeScopeViolation('https://other.org/', scope)).toContain(
      'This group is example.com'
    );
  });

  it('names the path when the domain is right and the path is not', () => {
    expect(
      describeScopeViolation('https://example.com/pages', scope)
    ).toContain('example.com/spaces');
  });

  it('lets anything into a folder that has said nothing yet', () => {
    expect(
      describeScopeViolation('https://anything.test/', {
        domain: '',
        host: '',
        path: ''
      })
    ).toBeNull();
  });
});
