import {
  patternToUrl,
  splitPattern,
  urlMatchesPattern
} from './tabGroupPattern';

describe('splitPattern', () => {
  it('splits at the first slash, assuming https', () => {
    expect(splitPattern('wiki.*/spaces')).toEqual({
      scheme: 'https:',
      host: 'wiki.*',
      path: '/spaces'
    });
  });

  it('is all host when no path is named', () => {
    expect(splitPattern('example.com')).toEqual({
      scheme: 'https:',
      host: 'example.com',
      path: ''
    });
  });

  it('takes the scheme that was typed, and a leading dot off', () => {
    expect(splitPattern('http://.example.com/x')).toEqual({
      scheme: 'http:',
      host: 'example.com',
      path: '/x'
    });
  });
});

describe('urlMatchesPattern', () => {
  it('matches a bare domain and everything under it', () => {
    expect(urlMatchesPattern('https://example.com/a', 'example.com')).toBe(
      true
    );
    expect(urlMatchesPattern('https://wiki.example.com/a', 'example.com')).toBe(
      true
    );
  });

  it('does not match a domain that merely ends the same way', () => {
    expect(urlMatchesPattern('https://notexample.com/', 'example.com')).toBe(
      false
    );
  });

  it('takes a wildcard pattern literally, across the whole host', () => {
    expect(urlMatchesPattern('https://wiki.example.com/', 'wiki.*')).toBe(true);
    expect(urlMatchesPattern('https://wiki.other.org/', 'wiki.*')).toBe(true);
    expect(urlMatchesPattern('https://docs.example.com/', 'wiki.*')).toBe(
      false
    );
  });

  it('matches a sub-domain and a path together', () => {
    expect(
      urlMatchesPattern('https://wiki.example.com/spaces/ABC', 'wiki.*/spaces')
    ).toBe(true);
    expect(
      urlMatchesPattern('https://wiki.example.com/pages/1', 'wiki.*/spaces')
    ).toBe(false);
  });

  it('treats a port as part of the address', () => {
    expect(
      urlMatchesPattern('http://localhost:3000/x', 'http://localhost:3000')
    ).toBe(true);
    expect(
      urlMatchesPattern('http://localhost:4000/x', 'http://localhost:3000')
    ).toBe(false);
  });

  it('matches any host on one port, with a path', () => {
    // `*:1234/path` — the port and the path pin it, the host is whatever.
    expect(
      urlMatchesPattern('http://localhost:1234/path/x', 'http://*:1234/path')
    ).toBe(true);
    expect(
      urlMatchesPattern('https://example.com:1234/path', '*:1234/path')
    ).toBe(true);
    // The scheme still has to agree, and it is https unless written otherwise.
    expect(
      urlMatchesPattern('https://example.com:1234/path', 'http://*:1234/path')
    ).toBe(false);
    expect(
      urlMatchesPattern('http://localhost:1234/other', 'http://*:1234/path')
    ).toBe(false);
    // No port on the address is not port 1234.
    expect(urlMatchesPattern('https://example.com/path', '*:1234/path')).toBe(
      false
    );
  });

  it('matches any port with a wildcard', () => {
    expect(
      urlMatchesPattern('http://localhost:4000/', 'http://localhost:*')
    ).toBe(true);
  });

  it('matches a ported host from a bare domain, scheme permitting', () => {
    expect(
      urlMatchesPattern('http://localhost:3000/', 'http://localhost')
    ).toBe(true);
  });

  it('means https unless another scheme is typed', () => {
    expect(urlMatchesPattern('https://example.com/', 'example.com')).toBe(true);
    expect(urlMatchesPattern('http://example.com/', 'example.com')).toBe(false);
  });

  it('takes every http page when that is all you wrote', () => {
    expect(urlMatchesPattern('http://anything.test/x', 'http://*')).toBe(true);
    expect(urlMatchesPattern('http://localhost:9/x', 'http://*')).toBe(true);
    expect(urlMatchesPattern('https://anything.test/x', 'http://*')).toBe(
      false
    );
  });

  it('takes http when http is what you wrote', () => {
    expect(
      urlMatchesPattern('http://localhost:3000/', 'http://localhost:3000')
    ).toBe(true);
    expect(
      urlMatchesPattern('https://localhost:3000/', 'http://localhost:3000')
    ).toBe(false);
  });

  it('wildcards a path as well', () => {
    expect(
      urlMatchesPattern('https://example.com/a/deep/thing', '*/a/*/thing')
    ).toBe(true);
  });

  it('belongs to nothing when the address cannot be read', () => {
    expect(urlMatchesPattern('not a url', '*')).toBe(false);
  });
});

describe('patternToUrl', () => {
  it('builds an address for a pattern that names one place', () => {
    expect(patternToUrl('example.com')).toBe('https://example.com');
    expect(patternToUrl('http://localhost:3000/app')).toBe(
      'http://localhost:3000/app'
    );
  });

  it('has none for a pattern that describes many', () => {
    // A definition is a shape, not a place: `wiki.*` picks no address.
    expect(patternToUrl('wiki.*')).toBeNull();
    expect(patternToUrl('*:1234/path')).toBeNull();
    expect(patternToUrl('example.com/*/thing')).toBeNull();
  });

  it('has none for a pattern with no host at all', () => {
    expect(patternToUrl('  ')).toBeNull();
  });
});
