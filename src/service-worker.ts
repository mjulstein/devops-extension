import type { FetchWorkItemsRequest, Settings } from '@/types';
import {
  LAST_VISITED_DEVOPS_CONTEXT_KEY,
  LAST_VISITED_WORK_ITEM_REF_KEY,
  parseLastVisitedDevOpsContext,
  parseLastVisitedWorkItemRef,
  tryCreateLastVisitedDevOpsContext,
  tryCreateLastVisitedWorkItemRef
} from './devops/lastVisitedContext';
import {
  SHORTCUT_RUN_KEY,
  type ShortcutRun
} from './sidepanel/shortcutDiagnostics';
import { isAzureDevOpsUrl } from './sidepanel/tabMessaging/isAzureDevOpsUrl';
import {
  loadQuickTaskLinks,
  loadStarredPages
} from './sidepanel/chromeStorage';
import { loadThemeTokens } from './sidepanel/theme';
import { addAppEnvironment, loadApps } from './sidepanel/apps/appsFolder';
import { normalizeTypedUrl, parseAppUrl } from './sidepanel/apps/appDns';
import {
  carryPathAcrossEnvironments,
  isSamePage
} from './sidepanel/apps/envSwitch';
import { findAppForUrl, suggestEnvName } from './sidepanel/apps/appMatch';
import { shouldCloseOnFocusChange } from './favoritesPalette/idleClose';
import { loadSettings } from './sidepanel/chromeStorage';
import { searchAllBookmarks } from './sidepanel/bookmarkSync';
import {
  blobToDataUrl,
  loadFaviconsForUrls
} from './favoritesPalette/faviconData';
import { TAB_ICON_STORAGE_KEY, sectionIconForUrl } from './devops/sectionIcons';
import { fetchChildTasksForActiveParent } from './devops/childTasks';
import { fetchPullRequestActivity } from './devops/pullRequestActivity';
import { fetchAdoTheme, setAdoTheme, type AdoTheme } from './devops/theme';
import { resolveActiveWorkItemContext } from './devops/activeParentContext';
import { createChildTaskFromActivePage } from './devops/taskCreation';
import { archiveQuickTask, createQuickTask } from './devops/quickTask';
import {
  fetchAuthoredWorkItems,
  fetchClosedParentRollup,
  fetchQuickTaskItems,
  fetchWorkItems
} from './devops/workItems';
import { setParentForActiveWorkItem } from './devops/parentAssignment';
import { ensurePat } from './devops/auth/ensurePat';
import { revokeAllExtensionPats } from './devops/auth/revokeAllExtensionPats';
import { createDefaultConnectionService } from './devops/auth/connectionService';
import { startBearerObserver } from './devops/auth/bearerObserver';

// Observe Azure DevOps request headers so a Bearer is available for PAT
// minting regardless of which realm issued the call.
startBearerObserver();

// Ctrl+Period (user-configurable in chrome://extensions/shortcuts): open the
// side panel and put the cursor in the starred-pages search. Opening the panel
// from a command handler is allowed because the command counts as a user
// gesture.
//
// Picking the keys is most of the work here, because a combination that is
// already taken is left unbound with no error anywhere: the command exists, has
// no shortcut, and pressing it does nothing. Two rounds of that:
//   - Ctrl+Shift+K is Duplicate Tab in Edge, and a browser shortcut always wins.
//   - Alt+Shift+* can be swallowed by Windows itself, which uses Alt+Shift to
//     switch keyboard layout, so Edge never sees the keypress to begin with.
// Ctrl and punctuation avoids both: Edge binds nearly every Ctrl+letter and
// Ctrl+digit, but not Ctrl+Period. Report what is actually bound so the next
// collision is diagnosable instead of mysterious — the side panel shows the
// same reading on Settings -> Tools.
void chrome.commands?.getAll().then((commands) => {
  for (const command of commands) {
    if (!command.name) {
      continue;
    }
    if (command.shortcut) {
      console.info(`[commands] "${command.name}" bound to ${command.shortcut}`);
    } else {
      console.warn(
        `[commands] "${command.name}" has NO shortcut — it probably clashes with a ` +
          'browser shortcut. Assign one at chrome://extensions/shortcuts.'
      );
    }
  }
});

// Icons the palette cannot fetch for itself, kept for the life of the worker so
// a wide search does not re-read the same pictures on every keystroke.
const faviconCache = new Map<string, string>();

async function loadFavicons(urls: string[]) {
  // The section icons the content script scraped from Azure DevOps's own nav,
  // or the built-in ones when it has not scraped yet. Without these every
  // Azure DevOps favorite draws the same site logo, which tells you nothing
  // about which of them is a board and which is a pipeline.
  const stored = await chrome.storage.local.get(TAB_ICON_STORAGE_KEY);
  const sectionIcons = (stored[TAB_ICON_STORAGE_KEY] ?? {}) as Record<
    string,
    string
  >;

  return await loadFaviconsForUrls(urls, faviconCache, {
    fetchFn: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, init),
    toDataUrl: blobToDataUrl,
    ownIconFor: (url) => sectionIconForUrl(url, sectionIcons)
  });
}

chrome.commands?.onCommand.addListener((command) => {
  if (command !== 'open-starred-search') {
    return;
  }

  void openFavoritesSearch();
});

/**
 * Opens the favorites search wherever it belongs: over an Azure DevOps page when
 * one is in front, otherwise in the side panel. Shared by the keyboard command
 * and the panel's own trigger so both land on the same surface.
 */
/**
 * The address of the page being looked at.
 *
 * The commands are run from the palette, which is a window of its own, so "the
 * current page" is the active tab of the window being browsed in rather than
 * anything the palette can see for itself.
 */
async function browsingPageUrl(): Promise<string | null> {
  const windowId = await browsingWindowId();
  if (windowId === null) {
    return null;
  }
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  return tab?.url ?? null;
}

/**
 * Runs a command from the `>` list.
 *
 * Both commands work from the page you are on, which is the point: you are
 * looking at an environment, so there is nothing to type. Which app it belongs
 * to is answered by the app folders you already have — an address containing an
 * app's name goes in that app's folder, punctuation ignored, because
 * `myapp-dev.orgname.com` is the app you called `my-app` and refusing it over a
 * hyphen would be correct and useless. Only when no folder matches is a name
 * read out of the address instead.
 *
 * The whole address is stored, path and query included, and the bookmark is
 * named after whatever the address says the environment is — a placeholder, one
 * rename away in the bookmark manager. Nothing depends on that name, so nothing
 * waits for it to be right.
 */
async function runQuickCommand(
  id: string,
  args: string[]
): Promise<{ ok: true } | { error: string }> {
  const settings = await loadSettings();
  const folder = settings.bookmarkFolderName;
  const apps = await loadApps(folder);

  if (id === 'add-app') {
    const [givenName] = args;
    const url = await browsingPageUrl();
    if (url === null) {
      return { error: 'No page to add. Open the app in a tab first.' };
    }

    const appName =
      givenName ?? findAppForUrl(apps, url)?.name ?? parseAppUrl(url)?.appName;
    if (!appName) {
      return { error: 'That address does not say what the app is called.' };
    }

    return await addAppEnvironment(folder, appName, suggestEnvName(url), url);
  }

  if (id === 'add-app-env') {
    const [env, givenUrl] = args;
    if (!env) {
      return { error: 'Name the environment: add app env <env> [url]' };
    }
    // A host typed into the command is an address: see normalizeTypedUrl.
    const url =
      givenUrl === undefined
        ? await browsingPageUrl()
        : normalizeTypedUrl(givenUrl);
    if (url == null) {
      return { error: 'No address to add.' };
    }

    // The folder you already have beats a name read out of the address.
    const appName =
      findAppForUrl(apps, url)?.name ?? parseAppUrl(url, env)?.appName;
    if (!appName) {
      return { error: 'That address does not say what the app is called.' };
    }

    return await addAppEnvironment(folder, appName, env, url);
  }

  return { error: `No such command: ${id}` };
}

/**
 * Opens one of an app's environments.
 *
 * Two things make this different from opening a favorite. The page you are on
 * comes with you: picking another environment while looking at a record is a
 * request for that record over there, not for the front page. And a tab already
 * showing exactly that address is raised rather than a second one opened beside
 * it — otherwise flipping between two environments leaves a row of duplicates
 * behind. Anything not already open gets a new tab, so the page you came from
 * is still there to go back to.
 */
async function openAppTarget(appName: string, url: string): Promise<void> {
  const settings = await loadSettings();
  const apps = await loadApps(settings.bookmarkFolderName);
  const app = apps.find((entry) => entry.name === appName);

  const target =
    app === undefined
      ? url
      : carryPathAcrossEnvironments(app, url, await browsingPageUrl());

  const tabs = await chrome.tabs.query({});
  const open = tabs.find(
    (tab) => tab.url !== undefined && isSamePage(tab.url, target)
  );

  if (open?.id != null) {
    await chrome.tabs.update(open.id, { active: true });
    if (open.windowId != null) {
      await chrome.windows.update(open.windowId, { focused: true });
    }
    return;
  }

  const windowId = await browsingWindowId();
  await chrome.tabs.create({
    url: target,
    ...(windowId === null ? {} : { windowId })
  });
  if (windowId !== null) {
    await chrome.windows.update(windowId, { focused: true });
  }
}

/** Everything the palette needs to draw itself, wherever it is drawn. */
async function loadFavoritesPaletteData() {
  const [favorites, quickTasks, tokens, apps] = await Promise.all([
    loadStarredPages(),
    loadQuickTaskLinks(),
    loadThemeTokens(),
    loadSettings().then((settings) => loadApps(settings.bookmarkFolderName))
  ]);
  const icons = await loadFavicons([
    ...favorites.map((page) => page.url),
    ...quickTasks.map((page) => page.url)
  ]);
  return { favorites, quickTasks, tokens, icons, apps };
}

/**
 * Which surface the shortcut opens.
 *
 * The window reaches every page, not only the ones a content script runs on,
 * and takes focus by being a window rather than by asking. The overlay is
 * faster and appears where the eye already is, but only on Azure DevOps. Both
 * are kept while the window is being lived with; this is the switch.
 */
type FavoritesSearchSurface = 'window' | 'overlay';
const FAVORITES_SEARCH_SURFACE: FavoritesSearchSurface = 'window';

async function openFavoritesSearch(): Promise<'overlay' | 'panel' | 'window'> {
  if (FAVORITES_SEARCH_SURFACE === 'window') {
    try {
      await openSingletonWindow('palette');
      await recordShortcutRun({
        opened: true,
        delivered: true,
        error: null,
        surface: 'window'
      });
      return 'window';
    } catch (windowError) {
      // Falls through to the surfaces below rather than leaving the keypress
      // with nothing to show for it.
      await recordShortcutRun({
        opened: false,
        delivered: false,
        error: describeError(windowError),
        surface: 'window'
      });
    }
  }

  return await (async () => {
    let opened = false;
    let delivered = false;
    let error: string | null = null;

    let paletteFailure: string | undefined;

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    // On an Azure DevOps page the palette is drawn over the page itself, which
    // is centred where the user is already looking and — because that document
    // holds focus — can put the cursor in its search field without a fight.
    // Anywhere else, and on a tab whose content script is not there to answer,
    // the side panel's own menu is the fallback rather than nothing at all.
    if (tab?.id != null && isAzureDevOpsUrl(tab.url)) {
      const tabId = tab.id;
      try {
        const [favorites, quickTasks, tokens] = await Promise.all([
          loadStarredPages(),
          loadQuickTaskLinks(),
          loadThemeTokens()
        ]);
        const icons = await loadFavicons([
          ...favorites.map((page) => page.url),
          ...quickTasks.map((page) => page.url)
        ]);
        const message = {
          type: 'OPEN_FAVORITES_PALETTE',
          payload: { favorites, quickTasks, tokens, icons }
        };

        try {
          await chrome.tabs.sendMessage(tabId, message);
        } catch {
          // A tab loaded before the extension was last reloaded has no content
          // script, and refreshing it by hand is not something to ask of anyone
          // — so inject one and ask again. This is the difference between the
          // palette working sometimes and working always.
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-script.js']
          });
          await chrome.tabs.sendMessage(tabId, message);
        }

        await recordShortcutRun({
          opened: true,
          delivered: true,
          error: null,
          surface: 'overlay'
        });
        return 'overlay';
      } catch (paletteError) {
        // Falls through to the side panel, but records why.
        paletteFailure = describeError(paletteError);
      }
    }

    try {
      if (tab?.windowId != null) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        opened = true;
      }
    } catch (openError) {
      // Opening can be refused — a browser may not count a command as the user
      // gesture the API requires. That must not stop the focus message: when
      // the panel is already open, delivering it is the whole job.
      error = describeError(openError);
    }

    // The panel may have only just started, so retry briefly rather than firing
    // once into a listener that does not exist yet.
    for (let attempt = 0; attempt < 10 && !delivered; attempt += 1) {
      try {
        await chrome.runtime.sendMessage({ type: 'FOCUS_STARRED_SEARCH' });
        delivered = true;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    if (!delivered && error === null) {
      console.warn('[commands] the panel never took the focus message');
    }

    await recordShortcutRun({
      opened,
      delivered,
      error,
      surface: 'panel',
      paletteError: paletteFailure
    });
    return 'panel';
  })();
}

/**
 * Records what the last keypress achieved, so the panel can say. A shortcut that
 * is bound and still does nothing is otherwise only diagnosable from the service
 * worker console, which is several clicks into a page most people never open.
 */
async function recordShortcutRun(run: Omit<ShortcutRun, 'at'>): Promise<void> {
  await chrome.storage.local.set({
    [SHORTCUT_RUN_KEY]: { ...run, at: Date.now() }
  });
}

/**
 * Reloads the Azure DevOps page in front, if that is what is in front.
 *
 * Azure DevOps reads its theme when the page loads, so changing the setting
 * leaves the open page looking exactly as it did — the switch appears to have
 * done nothing until the next reload. Only the active tab is reloaded: other
 * Azure DevOps tabs may hold half-written comments or work items, and losing
 * those to a theme change would be a poor trade.
 */
async function reloadActiveAzureDevOpsTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null && isAzureDevOpsUrl(tab.url)) {
    await chrome.tabs.reload(tab.id);
  }
}

/**
 * The extension's own pages that open in a window of their own.
 *
 * Both follow the same rule: exactly one at a time, in a window rather than a
 * tab, remembering where it was left. A second copy of either would be a second
 * view of the same state, free to disagree with the first on screen and to act
 * on things the other has already changed.
 */
const SINGLETON_WINDOWS = {
  bookmarks: {
    page: 'bookmarks.html',
    boundsKey: 'bookmarkManagerWindowBounds',
    defaults: { width: 1280, height: 900 }
  },
  settings: {
    page: 'settings.html',
    boundsKey: 'settingsWindowBounds',
    // Wide enough for the fields to sit in columns rather than in one ribbon.
    defaults: { width: 960, height: 820 }
  },
  palette: {
    page: 'palette.html',
    boundsKey: 'paletteWindowBounds',
    // Roughly the dialog's own size. It is a search box, not a workspace.
    defaults: { width: 620, height: 520 }
  },
  panel: {
    page: 'sidepanel.html',
    boundsKey: 'panelWindowBounds',
    // Narrow, because it is the side panel: the layout is built for that width
    // and a wide window only stretches the rows.
    defaults: { width: 460, height: 900 }
  }
} as const;

type SingletonWindowName = keyof typeof SINGLETON_WINDOWS;

interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function isWindowBounds(value: unknown): value is WindowBounds {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const bounds = value as Record<string, unknown>;
  return (['left', 'top', 'width', 'height'] as const).every(
    (key) => typeof bounds[key] === 'number'
  );
}

/** Every tab showing one of these pages, across every window. */
async function findSingletonWindowTabs(
  name: SingletonWindowName
): Promise<chrome.tabs.Tab[]> {
  const url = chrome.runtime.getURL(SINGLETON_WINDOWS[name].page);
  const tabs = await chrome.tabs.query({});
  // Matched by prefix rather than through the query's url filter: a tab still
  // loading carries its address in pendingUrl, and one the page has since given
  // a hash would not match the bare address exactly. The side panel's own
  // instance is not a tab, so it is never caught here.
  return tabs.filter((tab) =>
    (tab.url ?? tab.pendingUrl ?? '').startsWith(url)
  );
}

/**
 * Opens one of these pages in its own window, or raises the one already open.
 *
 * Any extra copy that has appeared regardless is closed, so the rule holds even
 * if a window was restored by the browser on startup.
 */
async function openSingletonWindow(name: SingletonWindowName): Promise<void> {
  if (name === 'palette') {
    await setPalettePinned(false);
    await markPaletteOpened();
  }
  const { page, boundsKey, defaults } = SINGLETON_WINDOWS[name];
  const url = chrome.runtime.getURL(page);
  const [existing, ...extras] = await findSingletonWindowTabs(name);

  if (existing?.id != null) {
    // Closed before focusing, so the one being raised is the survivor.
    const extraIds = extras
      .map((tab) => tab.id)
      .filter((id): id is number => id != null);
    if (extraIds.length > 0) {
      await chrome.tabs.remove(extraIds);
    }
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) {
      // A minimized window takes focus without showing itself, so it is
      // restored first.
      await chrome.windows.update(existing.windowId, {
        focused: true,
        state: 'normal'
      });
    }
    return;
  }

  const stored = await chrome.storage.local.get(boundsKey);
  const bounds = stored[boundsKey];

  await chrome.windows.create({
    url,
    type: 'popup',
    // Said outright rather than left to the default: this window is opened to
    // be typed into, and it is the one case where taking focus is the point.
    focused: true,
    ...(isWindowBounds(bounds)
      ? bounds
      : { ...defaults, ...(await centredOnCurrentWindow(defaults)) })
  });
}

/**
 * Where to put a window that has never been placed.
 *
 * Centred on the browser window in front rather than on the screen, since that
 * is the monitor being worked on — an extension cannot ask which display that
 * is without a permission that exists for a bigger purpose than this.
 */
async function centredOnCurrentWindow(size: {
  width: number;
  height: number;
}): Promise<{ left: number; top: number } | Record<string, never>> {
  try {
    const current = await chrome.windows.getLastFocused();
    if (
      current.left == null ||
      current.top == null ||
      current.width == null ||
      current.height == null
    ) {
      return {};
    }
    return {
      left: Math.round(current.left + (current.width - size.width) / 2),
      top: Math.round(current.top + (current.height - size.height) / 2)
    };
  } catch {
    // Letting the browser place it is a worse position, not a failure.
    return {};
  }
}

/**
 * Opens this extension's bookmark manager.
 *
 * It replaces the browser's own because the browser's cannot show what is
 * duplicated or empty, which is most of what it gets opened for.
 */
async function openBookmarkManager(): Promise<void> {
  await openSingletonWindow('bookmarks');
}

const PALETTE_PINNED_KEY = 'palettePinned';
const PALETTE_OPENED_AT_KEY = 'paletteOpenedAt';

/**
 * How long after opening the palette a focus change is not a dismissal.
 *
 * A popup does not take focus cleanly. The window the shortcut was pressed in
 * can hold it, or take it back, while the new one is being put on screen — and
 * the close-on-focus-change rule read that as the user clicking away and shut
 * the palette the instant it appeared. Focus has to settle before it can mean
 * anything. Short enough that deliberately clicking away a moment later still
 * closes it, and Escape and the backdrop never wait for it at all.
 */
const PALETTE_FOCUS_GRACE_MS = 1200;

async function markPaletteOpened(): Promise<void> {
  await chrome.storage.session.set({ [PALETTE_OPENED_AT_KEY]: Date.now() });
}

/** Whether the palette has just opened and its focus has yet to settle. */
async function isPaletteSettling(): Promise<boolean> {
  const stored = await chrome.storage.session.get(PALETTE_OPENED_AT_KEY);
  const openedAt = stored[PALETTE_OPENED_AT_KEY];
  return (
    typeof openedAt === 'number' &&
    Date.now() - openedAt < PALETTE_FOCUS_GRACE_MS
  );
}

/**
 * Whether the palette window has been pinned open.
 *
 * In session storage rather than in a variable: this worker is unloaded after a
 * short idle, and the focus change that would close the palette is exactly what
 * wakes it again — so a pin held in memory was reliably forgotten before it was
 * ever read, and the window closed anyway. Session storage is cleared when the
 * browser restarts, which is the lifetime a pin should have.
 */
async function isPalettePinned(): Promise<boolean> {
  const stored = await chrome.storage.session.get(PALETTE_PINNED_KEY);
  return stored[PALETTE_PINNED_KEY] === true;
}

async function setPalettePinned(pinned: boolean): Promise<void> {
  await chrome.storage.session.set({ [PALETTE_PINNED_KEY]: pinned });
}

/**
 * Closes the palette window when another browser window takes focus.
 *
 * `WINDOW_ID_NONE` is deliberately ignored: it means the browser itself went to
 * the background, which happens on every glance at another application, and
 * closing then would make the palette unusable the moment anything is copied
 * from somewhere else.
 */
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }
  void (async () => {
    const [pinned, settling] = await Promise.all([
      isPalettePinned(),
      isPaletteSettling()
    ]);
    const tabs = await findSingletonWindowTabs('palette');
    for (const tab of tabs) {
      if (
        tab.windowId != null &&
        shouldCloseOnFocusChange({
          pinned,
          settling,
          focusedWindowId: windowId,
          paletteWindowId: tab.windowId
        })
      ) {
        await chrome.windows.remove(tab.windowId);
      }
    }
  })();
});

/**
 * Opens the side panel on the window being browsed in.
 *
 * Asked for from the palette, which is a popup of its own — a popup has no side
 * panel, so opening it there would do nothing visible. The most recently focused
 * ordinary window is the one the panel belongs to.
 */
/**
 * The ordinary browser window the side panel belongs to.
 *
 * Fetched before it is needed, because `sidePanel.open` has to be called while
 * a user gesture is still active and any await in between spends it.
 */
async function browsingWindowId(): Promise<number | null> {
  const windows = await chrome.windows.getAll();
  const target =
    windows.find((window) => window.type === 'normal' && window.focused) ??
    windows.find((window) => window.type === 'normal');
  return target?.id ?? null;
}

async function openSidePanelForCurrentWindow(): Promise<void> {
  const windowId = await browsingWindowId();
  if (windowId === null) {
    throw new Error('No browser window to open the side panel in.');
  }
  // Worth attempting even though the gesture that asked for this happened in
  // another page: when the worker was woken by something the browser does count,
  // it works, and when it is refused the caller has already tried the direct
  // route itself.
  await chrome.sidePanel.open({ windowId });
}

/** Remembers where one of these windows was left, for the next time it opens. */
chrome.windows.onBoundsChanged.addListener((window) => {
  void (async () => {
    const { left, top, width, height } = window;
    if (left == null || top == null || width == null || height == null) {
      return;
    }
    for (const name of Object.keys(
      SINGLETON_WINDOWS
    ) as SingletonWindowName[]) {
      const tabs = await findSingletonWindowTabs(name);
      if (tabs.some((tab) => tab.windowId === window.id)) {
        await chrome.storage.local.set({
          [SINGLETON_WINDOWS[name].boundsKey]: { left, top, width, height }
        });
        return;
      }
    }
  })();
});

/**
 * Navigates to a favorite: in place by default, in a new tab when asked.
 *
 * Falls back to a new tab when there is no active tab to navigate, which is the
 * only thing left to do rather than silently dropping the request.
 */
async function openStarredPage(url: string, newTab: boolean): Promise<void> {
  if (!newTab) {
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    if (active?.id != null) {
      await chrome.tabs.update(active.id, { url });
      return;
    }
  }
  await chrome.tabs.create({ url });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type RuntimeMessage =
  | {
      type: 'PING_SERVICE_WORKER';
      payload?: undefined;
    }
  | {
      type: 'OPEN_FAVORITES_SEARCH';
      payload?: undefined;
    }
  | {
      type: 'SEARCH_BOOKMARKS';
      payload: {
        term: string;
      };
    }
  | {
      type: 'OPEN_PANEL_WINDOW';
      payload?: undefined;
    }
  | {
      type: 'GET_FAVORITES_PALETTE_DATA';
      payload?: undefined;
    }
  | {
      type: 'SET_PALETTE_PINNED';
      payload: { pinned: boolean };
    }
  | {
      type: 'OPEN_SETTINGS_WINDOW';
      payload?: undefined;
    }
  | {
      type: 'OPEN_SIDE_PANEL';
      payload?: undefined;
    }
  | {
      type: 'GET_BROWSING_WINDOW_ID';
      payload?: undefined;
    }
  | {
      type: 'ADD_APP_ENVIRONMENT';
      payload: { app: string; env: string; url: string };
    }
  | {
      type: 'RUN_QUICK_COMMAND';
      payload: { id: string; args: string[] };
    }
  | {
      type: 'OPEN_APP_TARGET';
      payload: { app: string; url: string };
    }
  | {
      type: 'OPEN_BOOKMARK_MANAGER';
      payload?: undefined;
    }
  | {
      type: 'OPEN_STARRED_PAGE';
      payload: {
        url: string;
        newTab?: boolean;
      };
    }
  | {
      type: 'FETCH_WORK_ITEMS';
      payload: FetchWorkItemsRequest;
    }
  | {
      type: 'FETCH_AUTHORED_WORK_ITEMS';
      payload: FetchWorkItemsRequest;
    }
  | {
      type: 'FETCH_CLOSED_PARENT_ROLLUP';
      payload: FetchWorkItemsRequest;
    }
  | {
      type: 'FETCH_PULL_REQUEST_ACTIVITY';
      payload: FetchWorkItemsRequest;
    }
  | {
      type: 'GET_ADO_THEME';
      payload: {
        settings: Settings;
      };
    }
  | {
      type: 'SET_ADO_THEME';
      payload: {
        settings: Settings;
        theme: AdoTheme;
      };
    }
  | {
      type: 'CREATE_QUICK_TASK';
      payload: {
        settings: Settings;
        pageTitle: string;
        pageUrl: string;
        title?: string;
      };
    }
  | {
      type: 'FETCH_QUICK_TASKS';
      payload: FetchWorkItemsRequest;
    }
  | {
      type: 'ARCHIVE_QUICK_TASK';
      payload: { settings: Settings; taskId: number };
    }
  | {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT';
      payload?: {
        forceResync?: boolean;
      };
    }
  | {
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT';
      payload?: {
        preferredParentId?: number;
      };
    }
  | {
      type: 'CREATE_CHILD_TASK';
      payload: {
        title: string;
        preferredParentId?: number;
      };
    }
  | {
      type: 'SET_ACTIVE_WORK_ITEM_PARENT';
      payload: {
        parentId: number;
        targetWorkItemId?: number;
      };
    }
  | {
      type: 'ROTATE_PAT';
      payload: { organization: string };
    }
  | {
      type: 'REVOKE_ALL_EXTENSION_PATS';
      payload: { organization: string };
    }
  | {
      type: 'ENSURE_CONNECTION';
      payload: { organization: string };
    }
  | {
      type: 'RETRY_CONNECTION';
      payload: { organization: string };
    }
  | {
      type: 'DEVOPS_BEARER_CAPTURED';
      payload?: undefined;
    };

function swDebug(message: string): void {
  void chrome.runtime
    .sendMessage({ type: 'SW_DEBUG', payload: { message } })
    .catch(() => undefined);
}

// Lazy ensure / manual retry / auto-recovery on a captured Bearer. Org for the
// auto path comes from the last-visited Azure DevOps context.
const connectionService = createDefaultConnectionService(
  resolveLastVisitedOrg,
  swDebug
);

async function resolveLastVisitedOrg(): Promise<string | null> {
  const stored = await chrome.storage.local.get(
    LAST_VISITED_DEVOPS_CONTEXT_KEY
  );
  const context = parseLastVisitedDevOpsContext(
    stored[LAST_VISITED_DEVOPS_CONTEXT_KEY]
  );
  return context?.organization ?? null;
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void seedLastVisitedFromActiveTab();
});

chrome.runtime.onStartup.addListener(() => {
  void seedLastVisitedFromActiveTab();
});

void seedLastVisitedFromActiveTab();

chrome.tabs.onActivated.addListener((activeInfo) => {
  void chrome.tabs
    .get(activeInfo.tabId)
    .then((tab) =>
      Promise.all([
        recordLastVisitedDevOpsContext(tab.url),
        recordLastVisitedWorkItemRef(tab.url)
      ])
    )
    .catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  const candidateUrl = changeInfo.url ?? tab.url;
  void recordLastVisitedDevOpsContext(candidateUrl);
  void recordLastVisitedWorkItemRef(candidateUrl);
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'PING_SERVICE_WORKER') {
      sendResponse({ ok: true, result: 'pong' });
      return;
    }

    if (message.type === 'OPEN_FAVORITES_SEARCH') {
      // The panel's trigger goes through the worker too, so the button and the
      // shortcut cannot disagree about where the search opens.
      openFavoritesSearch()
        .then((surface) => sendResponse({ ok: true, result: surface }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'SEARCH_BOOKMARKS') {
      // The palette runs in a page, which has no bookmarks API of its own — and
      // cannot load the favicon cache either, so the icons come with the rows.
      searchAllBookmarks(message.payload.term)
        .then(async (result) => ({
          result,
          icons: await loadFavicons(
            result.bookmarks.map((entry) => entry.page.url)
          )
        }))
        .then(({ result, icons }) =>
          sendResponse({ ok: true, result: { ...result, icons } })
        )
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'GET_FAVORITES_PALETTE_DATA') {
      loadFavoritesPaletteData()
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'SET_PALETTE_PINNED') {
      setPalettePinned(message.payload.pinned)
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'OPEN_SETTINGS_WINDOW') {
      openSingletonWindow('settings')
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'OPEN_APP_TARGET') {
      openAppTarget(message.payload.app, message.payload.url)
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'RUN_QUICK_COMMAND') {
      runQuickCommand(message.payload.id, message.payload.args)
        .then((result) =>
          sendResponse(
            'error' in result
              ? { ok: false, error: result.error }
              : { ok: true, result: null }
          )
        )
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'ADD_APP_ENVIRONMENT') {
      const { app, env, url } = message.payload;
      loadSettings()
        .then((settings) =>
          addAppEnvironment(settings.bookmarkFolderName, app, env, url)
        )
        .then((result) =>
          sendResponse(
            'error' in result
              ? { ok: false, error: result.error }
              : { ok: true, result: null }
          )
        )
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'GET_BROWSING_WINDOW_ID') {
      browsingWindowId()
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'OPEN_SIDE_PANEL') {
      openSidePanelForCurrentWindow()
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'OPEN_PANEL_WINDOW') {
      openSingletonWindow('panel')
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'OPEN_BOOKMARK_MANAGER') {
      openBookmarkManager()
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'OPEN_STARRED_PAGE') {
      // Sent by the in-page palette, which cannot manage tabs itself.
      openStarredPage(message.payload.url, message.payload.newTab === true)
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'GET_ACTIVE_WORK_ITEM_CONTEXT') {
      resolveRuntimeActiveWorkItemUrl(Boolean(message.payload?.forceResync))
        .then((url) => resolveActiveWorkItemContext(url))
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT') {
      resolveRuntimeActiveWorkItemUrl(false)
        .then((url) =>
          fetchChildTasksForActiveParent(
            url,
            message.payload?.preferredParentId
          )
        )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'CREATE_CHILD_TASK') {
      resolveRuntimeActiveWorkItemUrl(false)
        .then((url) =>
          createChildTaskFromActivePage(
            message.payload.title,
            url,
            message.payload.preferredParentId
          )
        )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'SET_ACTIVE_WORK_ITEM_PARENT') {
      resolveRuntimeActiveWorkItemUrl(false)
        .then((url) =>
          setParentForActiveWorkItem(
            url,
            message.payload.parentId,
            message.payload.targetWorkItemId
          )
        )
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'ROTATE_PAT') {
      const { organization } = message.payload;

      (async () => {
        swDebug(`rotate-pat: org="${organization}"`);

        // Step 1 — find DevOps tabs
        const tabs = await chrome.tabs.query({
          url: 'https://dev.azure.com/*'
        });
        swDebug(`rotate-pat: ${tabs.length} DevOps tab(s)`);

        // Step 2 — check bearer across all tabs in parallel (mirrors readBearerFromTab)
        if (tabs.length > 0) {
          const checks = await Promise.all(
            tabs
              .filter((t) => t.id != null)
              .map((t) =>
                Promise.race([
                  chrome.scripting
                    .executeScript({
                      target: { tabId: t.id! },
                      world: 'MAIN',
                      func: () =>
                        typeof (window as unknown as Record<string, unknown>)
                          .__devopsExtCapturedAuth === 'string'
                          ? 'captured'
                          : 'empty'
                    })
                    .then((r) => r[0]?.result as string)
                    .catch(() => 'err'),
                  new Promise<string>((resolve) =>
                    setTimeout(() => resolve('timeout'), 4_500)
                  )
                ])
              )
          );
          const captured = checks.filter((s) => s === 'captured').length;
          const timedOut = checks.filter((s) => s === 'timeout').length;
          swDebug(
            `rotate-pat: bearer — ${captured} captured, ${timedOut} timeout, ${checks.length - captured - timedOut} empty/err`
          );
        }

        // Step 3 — run ensurePat
        swDebug('rotate-pat: calling ensurePat...');
        const outcome = await ensurePat({ organization, force: true });
        swDebug(
          `rotate-pat: ensurePat=${outcome.status}${outcome.mintError ? ` err="${outcome.mintError}"` : ''}`
        );

        if (outcome.status !== 'connected' || !outcome.record) {
          throw new Error(
            outcome.mintError
              ? `PAT creation failed: ${outcome.mintError}`
              : 'Could not rotate the PAT. Open an Azure DevOps tab, wait for it to load, then try again.'
          );
        }
        sendResponse({ ok: true, result: outcome.record });
        // Sync connectionService so it broadcasts CONNECTION_STATUS:connected —
        // without this the side panel banner stays up until the next full reload.
        void connectionService.ensure(organization).catch(() => undefined);
      })().catch((error: Error) =>
        sendResponse({ ok: false, error: error.message })
      );

      return true;
    }

    if (message.type === 'REVOKE_ALL_EXTENSION_PATS') {
      const { organization } = message.payload;
      revokeAllExtensionPats(organization)
        .then((count) => sendResponse({ ok: true, result: count }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'ENSURE_CONNECTION') {
      connectionService
        .ensure(message.payload.organization)
        .then((status) => sendResponse({ ok: true, result: status }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'RETRY_CONNECTION') {
      connectionService
        .retry(message.payload.organization)
        .then((status) => sendResponse({ ok: true, result: status }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'DEVOPS_BEARER_CAPTURED') {
      void connectionService.handleBearerCaptured();
      return;
    }

    if (message.type === 'ARCHIVE_QUICK_TASK') {
      const { settings, taskId } = message.payload;
      const archiveId = Number(settings.quickTaskArchiveId.trim());

      resolveWorkItemsContext(settings)
        .then((context) =>
          archiveQuickTask({
            organization: context.organization,
            project: context.project,
            taskId,
            archiveId
          })
        )
        .then(() => sendResponse({ ok: true, result: taskId }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_QUICK_TASKS') {
      resolveWorkItemsContext(message.payload.settings)
        .then((context) => fetchQuickTaskItems(message.payload, context))
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'CREATE_QUICK_TASK') {
      const { settings, pageTitle, pageUrl, title } = message.payload;
      const parentId = Number(settings.quickTaskParentId.trim());

      resolveWorkItemsContext(settings)
        .then((context) =>
          createQuickTask({
            organization: context.organization,
            project: context.project,
            parentId,
            title,
            pageTitle,
            pageUrl,
            assignedTo: settings.assignedTo
          })
        )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'GET_ADO_THEME') {
      resolveWorkItemsContext(message.payload.settings)
        .then((context) => fetchAdoTheme(context.organization))
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'SET_ADO_THEME') {
      const { theme } = message.payload;
      resolveWorkItemsContext(message.payload.settings)
        .then((context) => setAdoTheme(context.organization, theme))
        .then(() => reloadActiveAzureDevOpsTab())
        .then(() => sendResponse({ ok: true, result: theme }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_PULL_REQUEST_ACTIVITY') {
      resolveWorkItemsContext(message.payload.settings)
        .then((context) =>
          fetchPullRequestActivity(context.organization, context.project)
        )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_CLOSED_PARENT_ROLLUP') {
      resolveWorkItemsContext(message.payload.settings)
        .then((context) => fetchClosedParentRollup(message.payload, context))
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_AUTHORED_WORK_ITEMS') {
      resolveWorkItemsContext(message.payload.settings)
        .then((context) => fetchAuthoredWorkItems(message.payload, context))
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type !== 'FETCH_WORK_ITEMS') {
      return;
    }

    resolveWorkItemsContext(message.payload.settings)
      .then((context) => fetchWorkItems(message.payload, context))
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: Error) =>
        sendResponse({ ok: false, error: error.message })
      );

    return true;
  }
);

async function resolveWorkItemsContext(
  settings: Settings
): Promise<{ organization: string; project: string }> {
  const orgOverride = settings.organization.trim();
  const projectOverride = settings.project.trim();

  const stored = await chrome.storage.local.get(
    LAST_VISITED_DEVOPS_CONTEXT_KEY
  );
  const lastVisited = parseLastVisitedDevOpsContext(
    stored[LAST_VISITED_DEVOPS_CONTEXT_KEY]
  );

  const fallbackContext =
    lastVisited ?? (await findDevOpsContextFromTabsForFallback());

  if (!lastVisited && fallbackContext) {
    await chrome.storage.local.set({
      [LAST_VISITED_DEVOPS_CONTEXT_KEY]: fallbackContext
    });
  }

  const organization = orgOverride || (fallbackContext?.organization ?? '');
  const project = projectOverride || (fallbackContext?.project ?? '');

  if (!organization || !project) {
    throw new Error(
      'Organization/project not resolved. Open a dev.azure.com project once or set overrides in Settings.'
    );
  }

  return { organization, project };
}

async function recordLastVisitedDevOpsContext(
  rawUrl: string | undefined
): Promise<void> {
  if (!rawUrl) {
    return;
  }

  const context = tryCreateLastVisitedDevOpsContext(rawUrl);
  if (!context) {
    return;
  }

  await chrome.storage.local.set({
    [LAST_VISITED_DEVOPS_CONTEXT_KEY]: context
  });
}

async function recordLastVisitedWorkItemRef(
  rawUrl: string | undefined
): Promise<void> {
  if (!rawUrl) {
    return;
  }

  const ref = tryCreateLastVisitedWorkItemRef(rawUrl);
  if (!ref) {
    return;
  }

  await chrome.storage.local.set({
    [LAST_VISITED_WORK_ITEM_REF_KEY]: ref
  });
}

async function seedLastVisitedFromActiveTab(): Promise<void> {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  await Promise.all([
    recordLastVisitedDevOpsContext(tabs[0]?.url),
    recordLastVisitedWorkItemRef(tabs[0]?.url)
  ]);
}

async function findDevOpsContextFromTabsForFallback() {
  const activeTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  const allTabs = await chrome.tabs.query({});
  const candidateUrls = [...activeTabs, ...allTabs].map((tab) => tab.url);

  for (const rawUrl of candidateUrls) {
    const context = tryCreateLastVisitedDevOpsContext(rawUrl ?? '');
    if (context) {
      return context;
    }
  }

  return null;
}

async function resolveRuntimeActiveWorkItemUrl(
  forceResync: boolean
): Promise<string> {
  if (forceResync) {
    const refreshedUrl = await findWorkItemUrlFromTabsForFallback();
    if (refreshedUrl) {
      await recordLastVisitedWorkItemRef(refreshedUrl);
      return refreshedUrl;
    }
  }

  const stored = await chrome.storage.local.get(LAST_VISITED_WORK_ITEM_REF_KEY);
  const storedRef = parseLastVisitedWorkItemRef(
    stored[LAST_VISITED_WORK_ITEM_REF_KEY]
  );

  if (storedRef) {
    return storedRef.url;
  }

  const fallbackUrl = await findWorkItemUrlFromTabsForFallback();
  if (fallbackUrl) {
    await recordLastVisitedWorkItemRef(fallbackUrl);
    return fallbackUrl;
  }

  throw new Error(
    'No recent Azure DevOps work item view found. Open a work item once to hydrate context.'
  );
}

async function findWorkItemUrlFromTabsForFallback(): Promise<string | null> {
  const activeTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  const allTabs = await chrome.tabs.query({});
  const candidateUrls = [...activeTabs, ...allTabs].map((tab) => tab.url);

  for (const rawUrl of candidateUrls) {
    if (!rawUrl) {
      continue;
    }

    if (tryCreateLastVisitedWorkItemRef(rawUrl)) {
      return rawUrl;
    }
  }

  return null;
}
