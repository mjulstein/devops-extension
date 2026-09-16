// The keyboard behaviour of the favorites palette, kept apart from the DOM.
//
// The palette renders into a page it does not own, so its element handling is
// necessarily imperative. Everything that decides *what should happen* lives
// here instead, where it can be tested without a browser.

import {
  buildFavoritesListing,
  type FavoritesSection,
  type FoldedBookmark
} from '@/sidepanel/favoritesListing';
import type { StarredPage } from '@/sidepanel/starredPages';

export interface PaletteView {
  /** Rows to show, ranked for the current query: favorites, then quick tasks. */
  rows: StarredPage[];
  /** Row the keyboard is on, always a valid index unless there are no rows. */
  highlight: number;
  /** The rows grouped as they are shown, each with its own divider label. */
  sections: FavoritesSection[];
}

/**
 * The rows for a query, with the highlight clamped into them.
 *
 * Clamping here rather than at each call site is what stops a highlight left
 * over from a longer result set pointing past the end of a shorter one.
 */
export function buildPaletteView(
  pages: StarredPage[],
  query: string,
  highlight: number,
  quickTasks: StarredPage[] = [],
  allBookmarks: FoldedBookmark[] = []
): PaletteView {
  const listing = buildFavoritesListing(pages, quickTasks, query, allBookmarks);
  const rows = listing.rows;
  if (rows.length === 0) {
    return { rows, highlight: 0, sections: [] };
  }
  return {
    rows,
    highlight: Math.min(Math.max(highlight, 0), rows.length - 1),
    sections: listing.sections
  };
}

export type PaletteKeyAction =
  | { kind: 'close' }
  | { kind: 'open'; index: number }
  | { kind: 'move'; highlight: number }
  | { kind: 'ignore' };

/**
 * What a keypress in the palette means.
 *
 * Arrow keys wrap, because a short list is faster to reach from either end than
 * to stop dead at. Enter with nothing matching does nothing rather than opening
 * an arbitrary page.
 */
export function resolvePaletteKey(
  key: string,
  view: PaletteView
): PaletteKeyAction {
  if (key === 'Escape') {
    return { kind: 'close' };
  }

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (view.rows.length === 0) {
      return { kind: 'ignore' };
    }
    const delta = key === 'ArrowDown' ? 1 : -1;
    const next = (view.highlight + delta + view.rows.length) % view.rows.length;
    return { kind: 'move', highlight: next };
  }

  if (key === 'Enter') {
    return view.rows.length === 0
      ? { kind: 'ignore' }
      : { kind: 'open', index: view.highlight };
  }

  return { kind: 'ignore' };
}
