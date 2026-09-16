// The favorites list as it is shown, in sections.
//
// Normally two: the favorites you chose, then the quick tasks that happen to be
// open. They are kept apart because they are different kinds of thing — a
// favorite is a place you picked and expect to stay put, a quick task is work
// that will vanish when it is done — and mixing them would let today's work push
// a board you rely on down the list.
//
// A widened search (see favoritesQuery) replaces both with the browser's own
// bookmarks, grouped under the folder each one lives in, because in a collection
// that size the folder is most of what tells two similar titles apart.

import { rankFavorites, type StarredPage } from './starredPages';
import { parseFavoritesQuery } from './favoritesQuery';

export interface FavoritesSection {
  /** Shown on the divider above the section; null for the leading one. */
  label: string | null;
  /** Whether the rows sit in from the edge, which is how folders read. */
  indent: boolean;
  /** Where this section's first row sits in `rows`. */
  startIndex: number;
  rows: StarredPage[];
}

export interface FavoritesListing {
  sections: FavoritesSection[];
  /** Every row in display order, which is what the keyboard walks. */
  rows: StarredPage[];
}

/** A bookmark plus the folder holding it, which is what the grouping needs. */
export interface FoldedBookmark {
  page: StarredPage;
  folder: string;
}

export function buildFavoritesListing(
  favorites: StarredPage[],
  quickTasks: StarredPage[],
  query: string,
  allBookmarks: FoldedBookmark[] = []
): FavoritesListing {
  const parsed = parseFavoritesQuery(query);

  if (parsed.scope === 'all') {
    return buildFolderListing(allBookmarks, parsed.term);
  }

  const rankedFavorites = rankFavorites(favorites, parsed.term);
  // A quick task already in the favorites would otherwise appear twice.
  const chosen = new Set(rankedFavorites.map((page) => page.url));
  const rankedQuickTasks = rankFavorites(quickTasks, parsed.term).filter(
    (page) => !chosen.has(page.url)
  );

  return buildSections([
    { label: null, indent: false, rows: rankedFavorites },
    { label: 'Quick tasks', indent: false, rows: rankedQuickTasks }
  ]);
}

/**
 * Bookmarks grouped by folder, folders in the order their first match appears,
 * so the ranking still decides what you see first.
 */
function buildFolderListing(
  bookmarks: FoldedBookmark[],
  term: string
): FavoritesListing {
  const byUrl = new Map(bookmarks.map((entry) => [entry.page.url, entry]));
  const ranked = rankFavorites(
    bookmarks.map((entry) => entry.page),
    term
  );

  const groups: { label: string; rows: StarredPage[] }[] = [];
  const byFolder = new Map<string, { label: string; rows: StarredPage[] }>();

  for (const page of ranked) {
    const folder = byUrl.get(page.url)?.folder ?? '';
    const existing = byFolder.get(folder);
    if (existing) {
      existing.rows.push(page);
      continue;
    }
    const group = { label: folder, rows: [page] };
    byFolder.set(folder, group);
    groups.push(group);
  }

  return buildSections(
    groups.map((group) => ({
      label: group.label || 'Bookmarks',
      indent: true,
      rows: group.rows
    }))
  );
}

function buildSections(
  parts: { label: string | null; indent: boolean; rows: StarredPage[] }[]
): FavoritesListing {
  const sections: FavoritesSection[] = [];
  const rows: StarredPage[] = [];

  for (const part of parts) {
    if (part.rows.length === 0) {
      continue;
    }
    sections.push({ ...part, startIndex: rows.length });
    rows.push(...part.rows);
  }

  return { sections, rows };
}
