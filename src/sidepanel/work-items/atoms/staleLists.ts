// The tab lists beyond TODO are lazily loaded, and a refetch has to invalidate
// them because they are derived from the same query parameters. Marking them
// stale rather than clearing them keeps the rows on screen while the refresh
// runs: a list the user has already seen never blanks out, it just refreshes in
// place.

/** The lazily-loaded lists that a work-items refetch invalidates. */
export type LazyListKey = 'authored' | 'quick' | 'prs' | 'closedRollup';

export type StaleLists = Record<LazyListKey, boolean>;

export const NO_STALE_LISTS: StaleLists = {
  authored: false,
  quick: false,
  prs: false,
  closedRollup: false
};

export const ALL_STALE_LISTS: StaleLists = {
  authored: true,
  quick: true,
  prs: true,
  closedRollup: true
};

/** Clears the stale mark for one list, leaving the others untouched. */
export function markFresh(state: StaleLists, key: LazyListKey): StaleLists {
  if (!state[key]) {
    return state;
  }

  return { ...state, [key]: false };
}

export function markStale(state: StaleLists, key: LazyListKey): StaleLists {
  if (state[key]) {
    return state;
  }

  return { ...state, [key]: true };
}

export interface ReloadDecision {
  /** Current rows, or `null` when the list has never loaded. */
  data: unknown[] | null;
  isLoading: boolean;
  isStale: boolean;
  /** Set after an action that is known to have changed the list. */
  force?: boolean;
}

/**
 * Whether a lazily-loaded list should fetch now. A fetch already in flight
 * always wins, so selecting a tab twice cannot start two requests.
 */
export function needsReload({
  data,
  isLoading,
  isStale,
  force = false
}: ReloadDecision): boolean {
  if (isLoading) {
    return false;
  }

  return force || data === null || isStale;
}
