import { getFavoriteIconUrl } from './favoriteIcon';

describe('getFavoriteIconUrl', () => {
  const page = 'https://example.test/one/two?x=1';

  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('asks the browser cache for the page it was given', () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://abc${path}`
      }
    };

    const result = getFavoriteIconUrl(page);

    expect(result).not.toBeNull();
    const parsed = new URL(result!);
    // chrome-extension: is not a special scheme, so origin reads as "null" —
    // the extension path is what matters here.
    expect(result).toContain('chrome-extension://abc/_favicon/');
    expect(parsed.pathname).toBe('/_favicon/');
    // The page url carries its own query string, so it has to survive encoding.
    expect(parsed.searchParams.get('pageUrl')).toBe(page);
    expect(parsed.searchParams.get('size')).toBe('16');
  });

  it('returns nothing outside the extension, rather than a network url', () => {
    expect(getFavoriteIconUrl(page)).toBeNull();
  });
});
