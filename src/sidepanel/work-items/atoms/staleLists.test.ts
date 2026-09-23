import { describe, expect, it } from 'vitest';
import {
  ALL_STALE_LISTS,
  NO_STALE_LISTS,
  markFresh,
  markStale,
  needsReload
} from './staleLists';

describe('needsReload', () => {
  it('loads a list that has never loaded', () => {
    expect(needsReload({ data: null, isLoading: false, isStale: false })).toBe(
      true
    );
  });

  it('does not reload a list that is already loaded and fresh', () => {
    expect(needsReload({ data: [], isLoading: false, isStale: false })).toBe(
      false
    );
  });

  it('reloads a loaded list once a refetch marked it stale', () => {
    expect(needsReload({ data: [], isLoading: false, isStale: true })).toBe(
      true
    );
  });

  it('never starts a second fetch while one is in flight', () => {
    expect(needsReload({ data: null, isLoading: true, isStale: true })).toBe(
      false
    );
    expect(
      needsReload({ data: [], isLoading: true, isStale: true, force: true })
    ).toBe(false);
  });

  it('reloads on force even when the list is fresh', () => {
    expect(
      needsReload({ data: [], isLoading: false, isStale: false, force: true })
    ).toBe(true);
  });
});

describe('markFresh / markStale', () => {
  it('clears only the named list', () => {
    const next = markFresh(ALL_STALE_LISTS, 'quick');

    expect(next.quick).toBe(false);
    expect(next.prs).toBe(true);
    expect(next.authored).toBe(true);
    expect(next.closedRollup).toBe(true);
  });

  it('returns the same object when nothing changes', () => {
    expect(markFresh(NO_STALE_LISTS, 'quick')).toBe(NO_STALE_LISTS);
    expect(markStale(ALL_STALE_LISTS, 'quick')).toBe(ALL_STALE_LISTS);
  });

  it('marks a single list stale', () => {
    expect(markStale(NO_STALE_LISTS, 'prs')).toEqual({
      ...NO_STALE_LISTS,
      prs: true
    });
  });
});
