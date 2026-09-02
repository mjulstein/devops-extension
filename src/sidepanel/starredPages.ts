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

  const trimmed = label.replace(/\s+/g, ' ').trim();
  return [{ url, label: trimmed || url, starredAt: now }, ...pages];
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
