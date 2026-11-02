// The open browser windows, read into rows for the deck.
//
// Named for what it reads rather than for the deck it feeds, because a file
// called `windowDeck.ts` beside `WindowDeck.tsx` is two files whose names
// differ only in case: a filesystem that does not care about case resolves
// `./WindowDeck` to whichever it finds first, and on Windows that was the
// model, which has no component to export.
//
// The Tabs tab answers "what have I got open"; this answers "where do I go
// now". They look alike on purpose — the same rows, the same move menu — but
// they are different questions, and a window is not a tab: it is a place you
// were working, and what identifies it is whatever is on top of it.
//
// Nothing here is stored. The order and the pins last as long as the deck is
// open, because a window id does not outlive the window and an order kept for
// windows that have closed is an order about nothing.

export interface DeckTab {
  id: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  active: boolean;
}

export interface DeckWindow {
  id: number;
  /** What the window is called: whatever is in front of you in it. */
  title: string;
  favIconUrl: string | null;
  tabs: DeckTab[];
  focused: boolean;
  incognito: boolean;
  /** A window with one tab is that tab, and says so rather than counting. */
  single: boolean;
  /**
   * The tab the window is showing, which is the one the deck names it after
   * and the one it offers to send off on its own.
   */
  frontTabId: number | null;
}

interface RawTab {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  active?: boolean;
}

interface RawWindow {
  id?: number;
  tabs?: RawTab[];
  focused?: boolean;
  incognito?: boolean;
  type?: string;
}

/**
 * The windows worth switching to.
 *
 * Only ordinary browser windows: a popup is something an extension or a page
 * put on the screen for a purpose, and offering to switch to one would put the
 * deck itself in the deck.
 *
 * A window's name is its active tab's, which is what you were looking at when
 * you left it — the one thing about a window you would recognise. A window
 * holding a single tab is that tab, which is why one belongs in this list at
 * all rather than being filed away as a window with nothing in it.
 */
export function readWindows(windows: RawWindow[]): DeckWindow[] {
  return windows
    .filter((window) => window.id !== undefined && window.type === 'normal')
    .map((window) => {
      const tabs = (window.tabs ?? [])
        .filter((tab): tab is RawTab & { id: number } => tab.id !== undefined)
        .map((tab) => ({
          id: tab.id,
          // A page that has not told us its title yet is still somewhere, and
          // its address says where better than the word "Untitled" does.
          title: (tab.title ?? '').trim() || (tab.url ?? '') || 'Untitled',
          url: tab.url ?? '',
          favIconUrl: tab.favIconUrl ?? null,
          active: tab.active === true
        }));
      const front = tabs.find((tab) => tab.active) ?? tabs[0];

      return {
        id: window.id ?? -1,
        title: front?.title ?? 'Empty window',
        favIconUrl: front?.favIconUrl ?? null,
        tabs,
        focused: window.focused === true,
        incognito: window.incognito === true,
        single: tabs.length === 1,
        frontTabId: front?.id ?? null
      };
    });
}

/**
 * The deck in the order it should be drawn.
 *
 * Pinned first, in the order they were pinned into place, then the rest. A pin
 * is a promise that a window stays where you can find it while everything else
 * moves underneath, which is most of what pinning is for in a list that
 * rearranges itself every time a window opens.
 *
 * Ids the order has never seen go after the ones it has, so a window opened
 * just now appears at the end rather than somewhere in the middle.
 */
export function orderWindows(
  windows: DeckWindow[],
  order: number[],
  pinned: number[]
): DeckWindow[] {
  const rank = (id: number): number => {
    const at = order.indexOf(id);
    return at < 0 ? order.length : at;
  };

  const pinnedWindows = pinned
    .map((id) => windows.find((window) => window.id === id))
    .filter((window): window is DeckWindow => window !== undefined);

  const rest = windows
    .filter((window) => !pinned.includes(window.id))
    .map((window, index) => ({ window, index }))
    .sort((a, b) => rank(a.window.id) - rank(b.window.id) || a.index - b.index)
    .map((entry) => entry.window);

  return [...pinnedWindows, ...rest];
}

/** The order with one id moved into the gap at this index. */
export function moveIdTo(
  ids: number[],
  id: number,
  gapIndex: number
): number[] {
  const from = ids.indexOf(id);
  if (from < 0) {
    return ids;
  }
  const without = [...ids.slice(0, from), ...ids.slice(from + 1)];
  const at = gapIndex > from ? gapIndex - 1 : gapIndex;
  return [...without.slice(0, at), id, ...without.slice(at)];
}

/** What closing a window would take with it, in words. */
export function describeWindow(window: DeckWindow): string {
  if (window.single) {
    return window.title;
  }
  return `${window.title} and ${window.tabs.length - 1} more`;
}
