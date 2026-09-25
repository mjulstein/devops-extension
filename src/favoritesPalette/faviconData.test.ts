import {
  collectOrigins,
  iconKeyFor,
  loadFaviconsForUrls,
  originOf
} from './faviconData';

describe('originOf', () => {
  it('reduces a page to the origin its icon belongs to', () => {
    expect(originOf('https://dev.azure.test/org/proj/_boards?x=1')).toBe(
      'https://dev.azure.test'
    );
  });

  it('returns null for something unparseable rather than guessing', () => {
    expect(originOf('not a url')).toBeNull();
  });
});

describe('collectOrigins', () => {
  it('collapses many pages of one site into a single fetch', () => {
    expect(
      collectOrigins([
        'https://a.test/one',
        'https://a.test/two',
        'https://b.test/three'
      ])
    ).toEqual(['https://a.test', 'https://b.test']);
  });

  it('caps the work a wide search can cause', () => {
    const urls = Array.from({ length: 50 }, (_, i) => `https://s${i}.test/`);

    expect(collectOrigins(urls, 3)).toHaveLength(3);
  });
});

describe('loadFaviconsForUrls', () => {
  const deps = {
    fetchFn: () => Promise.resolve(new Response('x', { status: 200 })),
    toDataUrl: () => Promise.resolve('data:image/png;base64,AAA')
  };

  beforeEach(() => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: { getURL: (path: string) => `chrome-extension://abc${path}` }
    };
  });

  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('returns one icon per origin', async () => {
    const icons = await loadFaviconsForUrls(
      ['https://a.test/one', 'https://a.test/two'],
      new Map(),
      deps
    );

    expect(icons).toEqual({ 'https://a.test': 'data:image/png;base64,AAA' });
  });

  it('fetches an origin once across calls, since the cache outlives them', async () => {
    let fetches = 0;
    const counting = {
      ...deps,
      fetchFn: () => {
        fetches += 1;
        return Promise.resolve(new Response('x', { status: 200 }));
      }
    };
    const cache = new Map<string, string>();

    await loadFaviconsForUrls(['https://a.test/one'], cache, counting);
    await loadFaviconsForUrls(['https://a.test/two'], cache, counting);

    expect(fetches).toBe(1);
  });

  it('remembers a miss, so a failing origin is not retried on every keystroke', async () => {
    let fetches = 0;
    const failing = {
      ...deps,
      fetchFn: () => {
        fetches += 1;
        return Promise.resolve(new Response('', { status: 404 }));
      }
    };
    const cache = new Map<string, string>();

    const first = await loadFaviconsForUrls(
      ['https://a.test/'],
      cache,
      failing
    );
    await loadFaviconsForUrls(['https://a.test/'], cache, failing);

    expect(first).toEqual({});
    expect(fetches).toBe(1);
  });
});

describe('iconKeyFor', () => {
  it('keys an ordinary page by origin', () => {
    expect(iconKeyFor('https://example.test/a?b=1')).toBe(
      'https://example.test'
    );
  });

  it('keys Azure DevOps by section, since the origin is shared', () => {
    expect(iconKeyFor('https://dev.azure.com/o/p/_boards/b')).toBe(
      'https://dev.azure.com#boards'
    );
    expect(iconKeyFor('https://dev.azure.com/o/p/_git/r')).toBe(
      'https://dev.azure.com#repos'
    );
  });

  it('is null for something unparseable', () => {
    expect(iconKeyFor('nonsense')).toBeNull();
  });
});

describe('loadFaviconsForUrls with an icon the caller already has', () => {
  it('uses it and never asks the browser cache', async () => {
    const fetchFn = vi.fn();
    const icons = await loadFaviconsForUrls(
      ['https://dev.azure.com/o/p/_boards/b', 'https://dev.azure.com/o/p/_git/r'],
      new Map(),
      {
        fetchFn: fetchFn as unknown as typeof fetch,
        toDataUrl: async () => '',
        ownIconFor: (url) => (url.includes('_git') ? 'repo.png' : 'board.png')
      }
    );

    expect(icons).toEqual({
      'https://dev.azure.com#boards': 'board.png',
      'https://dev.azure.com#repos': 'repo.png'
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
