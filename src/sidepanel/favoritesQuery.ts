// How a favorites search is read.
//
// The list normally covers the favorites folder and the open quick tasks, which
// is the point: a short, curated set. A leading "." widens the same box to every
// bookmark in the browser, for the times the thing you want was filed somewhere
// else entirely — without making the common case pay for the rare one.

export type FavoritesSearchScope = 'favorites' | 'all';

export interface FavoritesQuery {
  scope: FavoritesSearchScope;
  /** What to match on, with the scope character removed. */
  term: string;
}

/** The character that widens the search. */
export const ALL_BOOKMARKS_PREFIX = '.';

export function parseFavoritesQuery(raw: string): FavoritesQuery {
  if (raw.startsWith(ALL_BOOKMARKS_PREFIX)) {
    return { scope: 'all', term: raw.slice(1).trim() };
  }
  return { scope: 'favorites', term: raw.trim() };
}
