// How a favorites search is read.
//
// The list normally covers the favorites folder and the open quick tasks, which
// is the point: a short, curated set. A leading "." widens the same box to every
// bookmark in the browser, for the times the thing you want was filed somewhere
// else entirely — without making the common case pay for the rare one. A
// leading ">" turns it into a command list instead, for the few things you want
// while you are here that are not places at all.

export type FavoritesSearchScope = 'favorites' | 'all' | 'commands';

export interface FavoritesQuery {
  scope: FavoritesSearchScope;
  /** What to match on, with the scope character removed. */
  term: string;
}

/** The character that widens the search. */
export const ALL_BOOKMARKS_PREFIX = '.';

/**
 * The character that asks for commands instead of places.
 *
 * Same bargain as the widening prefix: the things you want here are actions
 * rather than places, and giving them a prefix of their own keeps them out of
 * the list you usually want without making that list longer to reach.
 */
export const COMMANDS_PREFIX = '>';

export function parseFavoritesQuery(raw: string): FavoritesQuery {
  if (raw.startsWith(COMMANDS_PREFIX)) {
    return { scope: 'commands', term: raw.slice(1).trimStart() };
  }
  if (raw.startsWith(ALL_BOOKMARKS_PREFIX)) {
    return { scope: 'all', term: raw.slice(1).trim() };
  }
  return { scope: 'favorites', term: raw.trim() };
}
