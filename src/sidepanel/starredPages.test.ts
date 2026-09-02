import {
  isPageStarred,
  moveStarredPage,
  normalizePageUrl,
  removeStarredPage,
  toggleStarredPage,
  updateStarredPage,
  type StarredPage
} from './starredPages';

const NOW = 1_800_000_000_000;

function page(url: string, label = 'Page'): StarredPage {
  return { url, label, starredAt: NOW };
}

describe('normalizePageUrl', () => {
  it('keeps origin, path and search', () => {
    expect(
      normalizePageUrl('https://dev.azure.com/org/proj/_boards/board?view=1')
    ).toBe('https://dev.azure.com/org/proj/_boards/board?view=1');
  });

  // A star is "the URL and its search params" — the fragment is not part of it.
  it('drops the hash', () => {
    expect(normalizePageUrl('https://x.invalid/a?b=1#section')).toBe(
      'https://x.invalid/a?b=1'
    );
  });

  it('treats a trailing slash as the same page', () => {
    expect(normalizePageUrl('https://x.invalid/a/')).toBe(
      normalizePageUrl('https://x.invalid/a')
    );
  });

  it('preserves parameter order as written', () => {
    expect(normalizePageUrl('https://x.invalid/a?b=1&a=2')).toBe(
      'https://x.invalid/a?b=1&a=2'
    );
  });

  it('reduces a bare origin to a single slash', () => {
    expect(normalizePageUrl('https://x.invalid')).toBe('https://x.invalid/');
  });

  it('rejects unparseable and non-http urls', () => {
    expect(normalizePageUrl('not a url')).toBeNull();
    expect(normalizePageUrl(undefined)).toBeNull();
    expect(normalizePageUrl('chrome-extension://abc/panel.html')).toBeNull();
  });
});

describe('isPageStarred', () => {
  const pages = [page('https://x.invalid/a?b=1')];

  it('matches ignoring the hash', () => {
    expect(isPageStarred(pages, 'https://x.invalid/a?b=1#deep')).toBe(true);
  });

  it('does not match a different query', () => {
    expect(isPageStarred(pages, 'https://x.invalid/a?b=2')).toBe(false);
  });

  it('is false for an unusable url', () => {
    expect(isPageStarred(pages, undefined)).toBe(false);
  });
});

describe('toggleStarredPage', () => {
  it('adds a new star newest-first', () => {
    const result = toggleStarredPage(
      [page('https://x.invalid/old')],
      'https://x.invalid/new',
      '  New   page ',
      NOW
    );
    expect(result.map((p) => p.url)).toEqual([
      'https://x.invalid/new',
      'https://x.invalid/old'
    ]);
    expect(result[0]?.label).toBe('New page');
  });

  it('removes an existing star, ignoring the hash', () => {
    expect(
      toggleStarredPage(
        [page('https://x.invalid/a')],
        'https://x.invalid/a#x',
        'l',
        NOW
      )
    ).toEqual([]);
  });

  it('falls back to the url when there is no label', () => {
    const result = toggleStarredPage([], 'https://x.invalid/a', '   ', NOW);
    expect(result[0]?.label).toBe('https://x.invalid/a');
  });

  it('ignores an unusable url', () => {
    expect(toggleStarredPage([], 'nope', 'l', NOW)).toEqual([]);
  });
});

describe('updateStarredPage', () => {
  const pages = [
    page('https://x.invalid/a', 'A'),
    page('https://x.invalid/b', 'B')
  ];

  it('edits label and url of the matching entry only', () => {
    const result = updateStarredPage(pages, 'https://x.invalid/a', {
      label: 'Renamed',
      url: 'https://x.invalid/c?q=1'
    });
    expect(result[0]).toMatchObject({
      url: 'https://x.invalid/c?q=1',
      label: 'Renamed'
    });
    expect(result[1]).toMatchObject({ url: 'https://x.invalid/b', label: 'B' });
  });

  // Losing the entry because of a typo would be worse than keeping the old url.
  it('keeps the old url when the edit is unusable', () => {
    const result = updateStarredPage(pages, 'https://x.invalid/a', {
      label: 'Renamed',
      url: 'garbage'
    });
    expect(result[0]?.url).toBe('https://x.invalid/a');
    expect(result[0]?.label).toBe('Renamed');
  });

  it('keeps the old label when the new one is blank', () => {
    const result = updateStarredPage(pages, 'https://x.invalid/a', {
      label: '   ',
      url: 'https://x.invalid/a'
    });
    expect(result[0]?.label).toBe('A');
  });
});

describe('removeStarredPage', () => {
  it('removes just that entry', () => {
    expect(
      removeStarredPage(
        [page('https://x.invalid/a'), page('https://x.invalid/b')],
        'https://x.invalid/a'
      ).map((p) => p.url)
    ).toEqual(['https://x.invalid/b']);
  });
});

describe('moveStarredPage', () => {
  const pages = [
    page('https://x.invalid/a'),
    page('https://x.invalid/b'),
    page('https://x.invalid/c')
  ];

  it('moves an entry up', () => {
    expect(
      moveStarredPage(pages, 'https://x.invalid/b', -1).map((p) => p.url)
    ).toEqual([
      'https://x.invalid/b',
      'https://x.invalid/a',
      'https://x.invalid/c'
    ]);
  });

  it('moves an entry down', () => {
    expect(
      moveStarredPage(pages, 'https://x.invalid/b', 1).map((p) => p.url)
    ).toEqual([
      'https://x.invalid/a',
      'https://x.invalid/c',
      'https://x.invalid/b'
    ]);
  });

  it('is a no-op at the edges and for unknown urls', () => {
    expect(moveStarredPage(pages, 'https://x.invalid/a', -1)).toBe(pages);
    expect(moveStarredPage(pages, 'https://x.invalid/c', 1)).toBe(pages);
    expect(moveStarredPage(pages, 'https://x.invalid/zz', 1)).toBe(pages);
  });
});
