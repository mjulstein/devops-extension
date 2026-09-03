import {
  buildDistinctLabel,
  isPageStarred,
  labelHintsFromUrl,
  listOpenablePages,
  moveStarredPage,
  normalizePageUrl,
  rankFavorites,
  removeStarredPage,
  sanitizeStarredPages,
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

describe('listOpenablePages', () => {
  const pages = [
    page('https://x.invalid/a?q=1', 'A'),
    page('https://x.invalid/b', 'B')
  ];

  // The menu is for going elsewhere; an entry for the current page does nothing.
  it('excludes the page currently open', () => {
    expect(
      listOpenablePages(pages, 'https://x.invalid/a?q=1').map((p) => p.label)
    ).toEqual(['B']);
  });

  it('excludes it regardless of the hash', () => {
    expect(
      listOpenablePages(pages, 'https://x.invalid/a?q=1#frag').map(
        (p) => p.label
      )
    ).toEqual(['B']);
  });

  it('keeps everything when the current page is not starred', () => {
    expect(
      listOpenablePages(pages, 'https://x.invalid/zzz').map((p) => p.label)
    ).toEqual(['A', 'B']);
  });

  it('keeps everything when there is no usable current url', () => {
    expect(listOpenablePages(pages, undefined)).toEqual(pages);
    expect(listOpenablePages(pages, 'chrome-extension://abc/x.html')).toEqual(
      pages
    );
  });
});

describe('labelHintsFromUrl', () => {
  // Path segments from the end first: that is where the specific part lives.
  it('offers path segments deepest first, then the query, then the host', () => {
    expect(
      labelHintsFromUrl(
        'https://dev.azure.com/org/proj/_boards/board/t/Frontend/Stories?x=1'
      )
    ).toEqual([
      'Stories',
      'Frontend',
      't',
      'board',
      '_boards',
      'proj',
      'org',
      'x=1',
      'dev.azure.com'
    ]);
  });

  it('decodes escaped segments', () => {
    expect(labelHintsFromUrl('https://x.invalid/my%20team')[0]).toBe('my team');
  });

  it('returns nothing for an unparseable url', () => {
    expect(labelHintsFromUrl('nope')).toEqual([]);
  });
});

describe('buildDistinctLabel', () => {
  it('leaves a unique title alone', () => {
    expect(
      buildDistinctLabel(
        [page('https://x.invalid/a', 'Boards')],
        'https://x.invalid/b',
        'Queries'
      )
    ).toBe('Queries');
  });

  // The whole point: two boards both titled "Boards" must be tellable apart.
  it('appends the distinguishing path segment on a duplicate title', () => {
    expect(
      buildDistinctLabel(
        [
          page(
            'https://dev.azure.com/o/p/_boards/board/t/Backend/Stories',
            'Boards'
          )
        ],
        'https://dev.azure.com/o/p/_boards/board/t/Frontend/Stories',
        'Boards'
      )
    ).toBe('Boards (Frontend)');
  });

  it('skips a hint already present in the title', () => {
    expect(
      buildDistinctLabel(
        [page('https://x.invalid/a/Stories', 'Stories')],
        'https://x.invalid/b/Stories',
        'Stories'
      )
    ).toBe('Stories (b)');
  });

  // Same path, different query — the query is what separates them.
  it('falls back to the query string when paths match', () => {
    expect(
      buildDistinctLabel(
        [page('https://x.invalid/_queries/query/?wiql=a', 'Queries')],
        'https://x.invalid/_queries/query/?wiql=b',
        'Queries'
      )
    ).toBe('Queries (wiql=b)');
  });

  it('is case and whitespace insensitive when detecting duplicates', () => {
    expect(
      buildDistinctLabel(
        [page('https://x.invalid/a', '  BOARDS  ')],
        'https://x.invalid/zz',
        'Boards'
      )
    ).toBe('Boards (zz)');
  });

  it('does not collide with an existing disambiguated label', () => {
    expect(
      buildDistinctLabel(
        [
          page('https://x.invalid/a/Stories', 'Boards'),
          page('https://x.invalid/b', 'Boards (Stories)')
        ],
        'https://x.invalid/c/Stories',
        'Boards'
      )
    ).toBe('Boards (c)');
  });

  // Guarantees uniqueness rather than merely usually achieving it.
  it('falls back to a counter when no url fragment helps', () => {
    expect(
      buildDistinctLabel(
        [
          page('https://x.invalid/a', 'Boards'),
          page('https://x.invalid/b', 'Boards (a)')
        ],
        'https://x.invalid/a',
        'Boards'
      )
    ).toBe('Boards (2)');
  });

  it('uses the url as the label when there is no title at all', () => {
    expect(buildDistinctLabel([], 'https://x.invalid/a', '   ')).toBe(
      'https://x.invalid/a'
    );
  });
});

describe('toggleStarredPage disambiguation', () => {
  it('stores a distinguished label for a duplicate title', () => {
    const existing = [
      page(
        'https://dev.azure.com/o/p/_boards/board/t/Backend/Stories',
        'Boards'
      )
    ];
    const result = toggleStarredPage(
      existing,
      'https://dev.azure.com/o/p/_boards/board/t/Frontend/Stories',
      'Boards',
      NOW
    );
    expect(result[0]?.label).toBe('Boards (Frontend)');
    expect(result[1]?.label).toBe('Boards');
  });
});

describe('rankFavorites', () => {
  const pages = [
    page('https://dev.azure.com/o/p/_queries/boards-report', 'Weekly report'),
    page(
      'https://dev.azure.com/o/p/_boards/board/t/Backend/Stories',
      'Boards (Backend)'
    ),
    page(
      'https://dev.azure.com/o/p/_boards/board/t/Frontend/Stories',
      'My boards view'
    )
  ];

  it('returns everything for an empty query', () => {
    expect(rankFavorites(pages, '  ')).toEqual(pages);
  });

  // Title beats address: the first entry only matches in its URL.
  it('ranks title matches above address matches', () => {
    expect(rankFavorites(pages, 'boards').map((p) => p.label)).toEqual([
      'Boards (Backend)',
      'My boards view',
      'Weekly report'
    ]);
  });

  it('ranks a title prefix above a title substring', () => {
    const result = rankFavorites(pages, 'boards');
    expect(result[0]?.label).toBe('Boards (Backend)');
    expect(result[1]?.label).toBe('My boards view');
  });

  it('is case insensitive', () => {
    expect(rankFavorites(pages, 'BACKEND')[0]?.label).toBe('Boards (Backend)');
  });

  it('still finds address-only matches', () => {
    expect(rankFavorites(pages, '_queries').map((p) => p.label)).toEqual([
      'Weekly report'
    ]);
  });

  it('drops non-matches', () => {
    expect(rankFavorites(pages, 'zzzz')).toEqual([]);
  });

  it('keeps the user ordering within a rank', () => {
    const same = [
      page('https://x.invalid/a', 'Alpha one'),
      page('https://x.invalid/b', 'Alpha two')
    ];
    expect(rankFavorites(same, 'alpha').map((p) => p.label)).toEqual([
      'Alpha one',
      'Alpha two'
    ]);
  });
});

describe('sanitizeStarredPages', () => {
  // Trimming on every keystroke is what made a trailing space impossible to
  // type, so it only happens here, at commit time.
  it('trims and collapses labels', () => {
    expect(
      sanitizeStarredPages([page('https://x.invalid/a', '  Two   words  ')])[0]
        ?.label
    ).toBe('Two words');
  });

  it('normalises addresses', () => {
    expect(
      sanitizeStarredPages([page('https://x.invalid/a/?q=1#frag', 'A')])[0]?.url
    ).toBe('https://x.invalid/a?q=1');
  });

  it('falls back to the address when the label is emptied', () => {
    expect(
      sanitizeStarredPages([page('https://x.invalid/a', '   ')])[0]?.label
    ).toBe('https://x.invalid/a');
  });

  it('drops entries whose address is unusable', () => {
    expect(sanitizeStarredPages([page('not a url', 'Broken')])).toEqual([]);
  });

  it('drops duplicates that normalise to the same address', () => {
    expect(
      sanitizeStarredPages([
        page('https://x.invalid/a', 'First'),
        page('https://x.invalid/a/', 'Second')
      ]).map((p) => p.label)
    ).toEqual(['First']);
  });

  it('preserves order and other fields', () => {
    const result = sanitizeStarredPages([
      page('https://x.invalid/b', 'B'),
      page('https://x.invalid/a', 'A')
    ]);
    expect(result.map((p) => p.label)).toEqual(['B', 'A']);
    expect(result[0]?.starredAt).toBe(NOW);
  });
});
