// The favorites palette as a window of its own.
//
// The in-page overlay only reaches Azure DevOps pages, because that is where the
// content script runs. A window reaches everywhere, and it takes focus by being
// a window rather than by asking — which was the whole difficulty with putting
// the search in the side panel.
//
// What it costs is immediacy: a window is perceptibly slower to appear than a
// div, and it can only be centred on the browser window rather than on whatever
// the eye was last resting on. That is the trade this surface exists to test.

import './theme.css';
import { openFavoritesPalette } from './favoritesPalette/favoritesPalette';
import type { FaviconMap } from './favoritesPalette/faviconData';
import type { WidenedSearchData } from './sidepanel/favoritesListing';
import type { StarredPage } from './sidepanel/starredPages';
import { applyTheme, loadLastKnownTheme } from './sidepanel/theme';

/**
 * How long the window may sit untouched before it closes itself.
 *
 * The window can be left behind in a way the overlay could not: it survives
 * switching to another application and comes back with it. Long enough to read
 * a list of favorites, short enough that one is never found hours later.
 */
const IDLE_CLOSE_MS = 15_000;

interface PaletteData {
  favorites: StarredPage[];
  quickTasks: StarredPage[];
  tokens: Record<string, string>;
  icons: FaviconMap;
}

async function ask<T>(type: string, payload?: unknown): Promise<T | null> {
  const response: { ok: boolean; result?: T } =
    await chrome.runtime.sendMessage(
      payload === undefined ? { type } : { type, payload }
    );
  return response.ok && response.result !== undefined ? response.result : null;
}

async function main(): Promise<void> {
  applyTheme(await loadLastKnownTheme());

  const data = (await ask<PaletteData>('GET_FAVORITES_PALETTE_DATA')) ?? {
    favorites: [],
    quickTasks: [],
    tokens: {},
    icons: {}
  };

  let pinned = false;
  let idleTimer: number | undefined;

  function armIdleClose(): void {
    window.clearTimeout(idleTimer);
    if (pinned) {
      return;
    }
    idleTimer = window.setTimeout(() => {
      window.close();
    }, IDLE_CLOSE_MS);
  }

  // Any sign of life restarts the clock. Pointer movement counts: reading a
  // list is not idleness, and the mouse moves while it happens.
  for (const type of ['keydown', 'pointermove', 'pointerdown', 'wheel']) {
    window.addEventListener(type, armIdleClose, { passive: true });
  }

  openFavoritesPalette({
    favorites: data.favorites,
    quickTasks: data.quickTasks,
    tokens: data.tokens,
    icons: data.icons,
    isPinned: pinned,
    onTogglePin: (next) => {
      pinned = next;
      // The worker closes this window when another one takes focus, so it is
      // the one that has to know.
      void chrome.runtime.sendMessage({
        type: 'SET_PALETTE_PINNED',
        payload: { pinned: next }
      });
      armIdleClose();
    },
    searchAllBookmarks: async (term: string) =>
      (await ask<WidenedSearchData & { icons: FaviconMap }>(
        'SEARCH_BOOKMARKS',
        { term }
      )) ?? { bookmarks: [], folders: [], icons: {} },
    onOpenBookmarkManager: () => {
      void chrome.runtime.sendMessage({ type: 'OPEN_BOOKMARK_MANAGER' });
    },
    onOpenPage: (url, newTab) => {
      void chrome.runtime.sendMessage({
        type: 'OPEN_STARRED_PAGE',
        payload: { url, newTab }
      });
    },
    // The palette is the only thing in this window, so dismissing it — by
    // Escape, by the backdrop, or by opening a row — is dismissing the window.
    onClose: () => {
      window.close();
    }
  });

  armIdleClose();
}

void main();
