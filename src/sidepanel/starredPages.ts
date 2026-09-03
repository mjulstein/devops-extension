// Starred Azure DevOps pages: a personal shortcut list in the side panel.
//
// A star identifies a page by its **URL and search parameters only**. The hash
// is dropped, so the same board with a different fragment is one star rather
// than several, and query parameters are kept because they are what distinguish
// one board or query view from another.

export interface StarredPage {
  /** Normalised identity of the page: origin + path + search. */
  url: string;
  label: string;
  starredAt: number;
}

/**
 * Canonical form used both to store a star and to recognise the current page.
 * Returns null for anything unparseable so callers can refuse to star it.
 */
export function normalizePageUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  // Trailing slashes are cosmetic; treating them as distinct would let the same
  // page be starred twice.
  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  return `${parsed.origin}${path}${parsed.search}`;
}

export function isPageStarred(
  pages: StarredPage[],
  rawUrl: string | undefined
): boolean {
  const url = normalizePageUrl(rawUrl);
  return url !== null && pages.some((page) => page.url === url);
}

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Fragments of a URL that could tell two same-titled pages apart, best first.
 *
 * Azure DevOps titles repeat constantly — every board is "Boards", every query
 * view is "Queries" — while the URL is what actually differs. Path segments are
 * tried from the end because that is where the specific part lives
 * (for example .../_boards/board/t/Frontend/Stories -> "Stories"), then the
 * query string, which separates two saved queries at the same path.
 */
export function labelHintsFromUrl(url: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }

  const hints: string[] = [];
  const segments = parsed.pathname
    .split('/')
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);

  for (const segment of [...segments].reverse()) {
    hints.push(segment);
  }
  if (parsed.search.length > 1) {
    hints.push(parsed.search.slice(1));
  }
  hints.push(parsed.host);

  return hints;
}

/**
 * A label that is not already taken by another favorite.
 *
 * Duplicate titles with different URLs are common, and a list of identical
 * names cannot be used. The first URL fragment that actually distinguishes it is
 * appended in parentheses; if none does, a counter is, so the result is always
 * unique rather than merely usually unique.
 */
export function buildDistinctLabel(
  pages: StarredPage[],
  url: string,
  label: string
): string {
  const base = label.replace(/\s+/g, ' ').trim() || url;
  const taken = new Set(pages.map((page) => normalizeLabel(page.label)));

  if (!taken.has(normalizeLabel(base))) {
    return base;
  }

  // Only fragments the colliding pages do NOT share can distinguish anything.
  // Two boards both end in "Stories", so appending "Stories" would produce a
  // second uninformative entry; what separates them is "Frontend" vs "Backend".
  const prefix = `${normalizeLabel(base)} (`;
  const collidingHints = new Set(
    pages
      .filter((page) => {
        const existing = normalizeLabel(page.label);
        return existing === normalizeLabel(base) || existing.startsWith(prefix);
      })
      .flatMap((page) => labelHintsFromUrl(page.url).map(normalizeLabel))
  );

  for (const hint of labelHintsFromUrl(url)) {
    const normalizedHint = normalizeLabel(hint);
    // A hint already inside the title adds nothing to read.
    if (normalizeLabel(base).includes(normalizedHint)) {
      continue;
    }
    if (collidingHints.has(normalizedHint)) {
      continue;
    }
    const candidate = `${base} (${hint})`;
    if (!taken.has(normalizeLabel(candidate))) {
      return candidate;
    }
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} (${suffix})`;
    if (!taken.has(normalizeLabel(candidate))) {
      return candidate;
    }
  }
}

/**
 * Adds or removes a star. Newest first, so a freshly starred page is easy to
 * find in the menu.
 */
export function toggleStarredPage(
  pages: StarredPage[],
  rawUrl: string | undefined,
  label: string,
  now = Date.now()
): StarredPage[] {
  const url = normalizePageUrl(rawUrl);
  if (url === null) {
    return pages;
  }

  if (pages.some((page) => page.url === url)) {
    return pages.filter((page) => page.url !== url);
  }

  return [
    { url, label: buildDistinctLabel(pages, url, label), starredAt: now },
    ...pages
  ];
}

/**
 * The pages the menu should offer to open.
 *
 * The page you are already looking at is excluded: the menu exists to get you
 * somewhere else, and an entry that navigates nowhere is just noise. Whether the
 * current page is starred is shown by the toggle beside the menu instead.
 */
export function listOpenablePages(
  pages: StarredPage[],
  currentUrl: string | undefined
): StarredPage[] {
  const current = normalizePageUrl(currentUrl);
  return current === null
    ? pages
    : pages.filter((page) => page.url !== current);
}

/** Applies an edit from the favorites editor, keyed by the original url. */
export function updateStarredPage(
  pages: StarredPage[],
  originalUrl: string,
  next: { label: string; url: string }
): StarredPage[] {
  const normalized = normalizePageUrl(next.url);
  return pages.map((page) => {
    if (page.url !== originalUrl) {
      return page;
    }
    return {
      ...page,
      label: next.label.trim() || page.label,
      // Keep the old url if the edited one is unusable, rather than losing the entry.
      url: normalized ?? page.url
    };
  });
}

export function removeStarredPage(
  pages: StarredPage[],
  url: string
): StarredPage[] {
  return pages.filter((page) => page.url !== url);
}

export function moveStarredPage(
  pages: StarredPage[],
  url: string,
  direction: -1 | 1
): StarredPage[] {
  const index = pages.findIndex((page) => page.url === url);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= pages.length) {
    return pages;
  }
  const next = [...pages];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Orders favorites for a search box.
 *
 * The title is what you think in, so title matches always beat address matches,
 * and a title that *starts* with what you typed beats one that merely contains
 * it. Without that ranking, typing a board name can surface an unrelated
 * favorite whose URL happens to contain the letters, which makes the box feel
 * arbitrary. Ties keep the user's own ordering.
 */
export function rankFavorites(
  pages: StarredPage[],
  query: string
): StarredPage[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return pages;
  }

  const scored: { page: StarredPage; rank: number; index: number }[] = [];

  pages.forEach((page, index) => {
    const label = page.label.toLowerCase();
    const url = page.url.toLowerCase();

    let rank: number | null = null;
    if (label.startsWith(needle)) {
      rank = 0;
    } else if (label.includes(needle)) {
      rank = 1;
    } else if (url.includes(needle)) {
      rank = 2;
    }

    if (rank !== null) {
      scored.push({ page, rank, index });
    }
  });

  return scored
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.page);
}

/**
 * Cleans up edited favorites at commit time.
 *
 * Trimming belongs here and not on every keystroke: doing it as the user types
 * makes a trailing space impossible to enter, because it is removed again before
 * the next character arrives.
 */
export function sanitizeStarredPages(pages: StarredPage[]): StarredPage[] {
  const seen = new Set<string>();
  const result: StarredPage[] = [];

  for (const page of pages) {
    const normalized = normalizePageUrl(page.url);
    // An unusable address would be lost on reload, so the entry is dropped
    // rather than silently kept in a broken state.
    if (normalized === null || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push({
      ...page,
      url: normalized,
      label: page.label.replace(/\s+/g, ' ').trim() || normalized
    });
  }

  return result;
}
