import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings } from '@/types';
import { loadSettings } from '@/sidepanel/chromeStorage';
import {
  expectRuntimeResponse,
  type RuntimeResponse
} from '@/sidepanel/tabMessaging/runtimeResponse';
import {
  addDays,
  dayKey,
  emptyRangesKey,
  nextWindow,
  parseMinChanges,
  recordEmpty,
  workingDays,
  type ActivityChange,
  type DayRange
} from '@/devops/workDay';
import type { ActivityItem, WindowActivity } from '@/devops/workDayApi';

/**
 * Windows searched and found empty, per user and N. Browser-local: a past
 * day's history does not change, so it never needs searching again.
 */
const EMPTY_RANGES_KEY = 'workDayEmptyRanges';

type EmptyRangeStore = Record<string, DayRange[]>;

async function loadEmptyRanges(key: string): Promise<DayRange[]> {
  const stored = await chrome.storage.local.get(EMPTY_RANGES_KEY);
  const all = stored[EMPTY_RANGES_KEY] as EmptyRangeStore | undefined;
  const ranges = all?.[key];
  return Array.isArray(ranges) ? ranges : [];
}

async function saveEmptyRanges(key: string, ranges: DayRange[]): Promise<void> {
  const stored = await chrome.storage.local.get(EMPTY_RANGES_KEY);
  const all = (stored[EMPTY_RANGES_KEY] as EmptyRangeStore | undefined) ?? {};
  await chrome.storage.local.set({
    [EMPTY_RANGES_KEY]: { ...all, [key]: ranges }
  });
}

async function fetchWindow(
  settings: Settings,
  range: DayRange
): Promise<RuntimeResponse<WindowActivity>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'FETCH_WORK_DAY_ACTIVITY',
      payload: { settings, from: range.from, to: range.to }
    }),
    'FETCH_WORK_DAY_ACTIVITY'
  );
}

export interface WorkDayState {
  settings: Settings | null;
  identity: string;
  minChanges: number;
  /** The day on screen, or null while none is found. */
  day: string | null;
  /** Every change loaded so far, across windows. */
  changes: ActivityChange[];
  items: Map<number, ActivityItem>;
  /** The oldest day searched so far. */
  searchedFrom: string | null;
  /** The last window that held no working day, for the heading. */
  emptyWindow: DayRange | null;
  isLoading: boolean;
  error: string | null;
  canGoForward: boolean;
  back: () => void;
  forward: () => void;
}

export function useWorkDay(): WorkDayState {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [identity, setIdentity] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [changes, setChanges] = useState<ActivityChange[]>([]);
  const [items, setItems] = useState<Map<number, ActivityItem>>(
    () => new Map()
  );
  const [searchedFrom, setSearchedFrom] = useState<string | null>(null);
  const [emptyWindow, setEmptyWindow] = useState<DayRange | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  // Fixed for the page's life: a window left open past midnight keeps the
  // day it was opened on rather than shifting under the user.
  const [yesterday] = useState(() => addDays(dayKey(new Date()), -1));

  const minChanges = parseMinChanges(settings?.workDayMinChanges ?? '');

  /** Searches one window ending at `end`, and lands on its newest working day. */
  const searchFrom = useCallback(
    async (current: Settings, end: string, loaded: ActivityChange[]) => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const n = parseMinChanges(current.workDayMinChanges);
        const key = emptyRangesKey(current.assignedTo, n);
        const empty = await loadEmptyRanges(key);
        const range = nextWindow(end, empty);
        const response = await fetchWindow(current, range);
        if (!response.ok) {
          setError(response.error);
          return;
        }
        const { result } = response;
        setIdentity(result.identity);
        const merged = [...loaded, ...result.changes];
        setChanges(merged);
        setItems((previous) => {
          const next = new Map(previous);
          for (const item of result.items) {
            next.set(item.id, item);
          }
          return next;
        });
        setSearchedFrom(range.from);

        const found = workingDays(result.changes, range, n);
        if (found.length > 0) {
          setDay(found[0]);
          setEmptyWindow(null);
        } else {
          setDay(null);
          setEmptyWindow(range);
          // Only a resolved identity makes "nothing" trustworthy enough to keep.
          if (result.identity !== '') {
            await saveEmptyRanges(key, recordEmpty(empty, range));
          }
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        busyRef.current = false;
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadSettings().then((loaded) => {
      setSettings(loaded);
      void searchFrom(loaded, yesterday, []);
    });
  }, [searchFrom, yesterday]);

  const loadedDays = useMemo(
    () =>
      searchedFrom
        ? workingDays(
            changes,
            { from: searchedFrom, to: yesterday },
            minChanges
          )
        : [],
    [changes, searchedFrom, yesterday, minChanges]
  );

  const back = useCallback(() => {
    if (!settings || !searchedFrom) {
      return;
    }
    // Loaded days are newest first; an empty window on screen is older than
    // all of them, so from there the only way back is a new search.
    const older = day === null ? undefined : loadedDays.find((d) => d < day);
    if (older) {
      setDay(older);
      setEmptyWindow(null);
      return;
    }
    void searchFrom(settings, addDays(searchedFrom, -1), changes);
  }, [settings, searchedFrom, loadedDays, day, changes, searchFrom]);

  const newer =
    day === null
      ? loadedDays[loadedDays.length - 1]
      : [...loadedDays].reverse().find((d) => d > day);

  const forward = useCallback(() => {
    if (newer) {
      setDay(newer);
      setEmptyWindow(null);
    }
  }, [newer]);

  return {
    settings,
    identity,
    minChanges,
    day,
    changes,
    items,
    searchedFrom,
    emptyWindow,
    isLoading,
    error,
    canGoForward: newer !== undefined,
    back,
    forward
  };
}
