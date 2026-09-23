// The favorites list as it is shown, in sections.
//
// Normally two: the favorites you chose, then the quick tasks that happen to be
// open. They are kept apart because they are different kinds of thing — a
// favorite is a place you picked and expect to stay put, a quick task is work
// that will vanish when it is done — and mixing them would let today's work push
// a board you rely on down the list.
//
// A widened search (see favoritesQuery) replaces both with the browser's own
// bookmarks. With nothing typed it offers the folders instead of every bookmark
// you own, because the folders are how you already organise them and picking one
// is how you reach a list worth reading. Once something is typed, a folder whose
// name matches brings its whole contents along.

import { rankFavorites, type StarredPage } from './starredPages';
import { parseFavoritesQuery } from './favoritesQuery';
import type { BookmarkFolder } from './bookmarkFolders';

/** A row is somewhere to go, or a folder to look inside. */
export type FavoritesRow =
  | { kind: 'page'; page: StarredPage }
  | { kind: 'folder'; folder: BookmarkFolder };

export interface FavoritesSection {
  /** Shown on the divider above the section; null for the leading one. */
  label: string | null;
  /** Whether the rows sit in from the edge, which is how folders read. */
  indent: boolean;
  /** Where this section's first row sits in `rows`. */
  startIndex: number;
  rows: FavoritesRow[];
}

export interface FavoritesListing {
  sections: FavoritesSection[];
  /** Every row in display order, which is what the keyboard walks. */
  rows: FavoritesRow[];
}

/** A bookmark plus the folder holding it, which is what the grouping needs. */
export interface FoldedBookmark {
  page: StarredPage;
  folder: string;
  /**
   * True when this came along because its *folder* matched, not its own title.
   * Those are exempt from the term filter: asking for a folder by name and then
   * being shown only the bookmarks inside it that repeat that name would answer
   * a question nobody asked.
   */
  viaFolder?: boolean;
}

export interface WidenedSearchData {
  bookmarks: FoldedBookmark[];
  folders: BookmarkFolder[];
}

export function buildFavoritesListing(
  favorites: StarredPage[],
  quickTasks: StarredPage[],
  query: string,
  widened: WidenedSearchData = { bookmarks: [], folders: [] }
): FavoritesListing {
  const parsed = parseFavoritesQuery(query);

  if (parsed.scope === 'all') {
    return buildWidenedListing(widened, parsed.term);
  }

  const rankedFavorites = rankFavorites(favorites, parsed.term);
  // A quick task already in the favorites would otherwise appear twice.
  const chosen = new Set(rankedFavorites.map((page) => page.url));
  const rankedQuickTasks = rankFavorites(quickTasks, parsed.term).filter(
    (page) => !chosen.has(page.url)
  );

  return buildSections([
    { label: null, indent: false, rows: toPageRows(rankedFavorites) },
    {
      label: 'Quick tasks',
      indent: false,
      rows: toPageRows(rankedQuickTasks)
    }
  ]);
}

/**
 * Folders first, then the bookmarks themselves grouped by folder.
 *
 * Folders lead because they are the shorter list and the one that stays useful
 * as the collection grows.
 */
function buildWidenedListing(
  widened: WidenedSearchData,
  term: string
): FavoritesListing {
  const folderRows: FavoritesRow[] = widened.folders.map((folder) => ({
    kind: 'folder',
    folder
  }));

  const parts: {
    label: string | null;
    indent: boolean;
    rows: FavoritesRow[];
  }[] = [{ label: 'Folders', indent: false, rows: folderRows }];

  const byUrl = new Map(
    widened.bookmarks.map((entry) => [entry.page.url, entry])
  );

  // Contents of a matched folder come through whole and first; everything else
  // still has to earn its place by matching.
  const fromFolders = widened.bookmarks
    .filter((entry) => entry.viaFolder)
    .map((entry) => entry.page);
  const matchedDirectly = rankFavorites(
    widened.bookmarks
      .filter((entry) => !entry.viaFolder)
      .map((entry) => entry.page),
    term
  );

  const groups: { label: string; rows: FavoritesRow[] }[] = [];
  const byFolder = new Map<string, { label: string; rows: FavoritesRow[] }>();
  const placed = new Set<string>();

  for (const page of [...fromFolders, ...matchedDirectly]) {
    if (placed.has(page.url)) {
      continue;
    }
    placed.add(page.url);
    const folder = byUrl.get(page.url)?.folder ?? '';
    const existing = byFolder.get(folder);
    const row: FavoritesRow = { kind: 'page', page };
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    const group = { label: folder || 'Bookmarks', rows: [row] };
    byFolder.set(folder, group);
    groups.push(group);
  }

  for (const group of groups) {
    parts.push({ label: group.label, indent: true, rows: group.rows });
  }

  return buildSections(parts);
}

function toPageRows(pages: StarredPage[]): FavoritesRow[] {
  return pages.map((page) => ({ kind: 'page', page }));
}

function buildSections(
  parts: { label: string | null; indent: boolean; rows: FavoritesRow[] }[]
): FavoritesListing {
  const sections: FavoritesSection[] = [];
  const rows: FavoritesRow[] = [];

  for (const part of parts) {
    if (part.rows.length === 0) {
      continue;
    }
    sections.push({ ...part, startIndex: rows.length });
    rows.push(...part.rows);
  }

  return { sections, rows };
}

/** The key a row renders under, unique across pages and folders. */
export function rowKey(row: FavoritesRow): string {
  return row.kind === 'page'
    ? `page:${row.page.url}`
    : `folder:${row.folder.id}`;
}

/** What a row says on screen. */
export function rowLabel(row: FavoritesRow): string {
  return row.kind === 'page' ? row.page.label : row.folder.title;
}

/** The second line: an address for a page, the location and size for a folder. */
export function rowDetail(row: FavoritesRow): string {
  if (row.kind === 'page') {
    return row.page.url;
  }
  const count = `${row.folder.count} bookmark${row.folder.count === 1 ? '' : 's'}`;
  return row.folder.path ? `${row.folder.path} · ${count}` : count;
}
