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
import { searchAllBookmarks } from './sidepanel/bookmarkSync';
import {
  blobToDataUrl,
  loadFaviconsForUrls
} from './favoritesPalette/faviconData';
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

function loadFavicons(urls: string[]) {
  return loadFaviconsForUrls(urls, faviconCache, {
    fetchFn: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, init),
    toDataUrl: blobToDataUrl
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
async function openFavoritesSearch(): Promise<'overlay' | 'panel'> {
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
 * Opens this extension's bookmark manager, reusing its tab if one is open.
 *
 * It replaces the browser's own manager here because the browser's cannot show
 * what is duplicated or empty, which is most of what the page is opened to fix.
 * A second tab of it would be two views of the same tree that can disagree on
 * screen, so an open one is raised instead.
 */
async function openBookmarkManager(): Promise<void> {
  const url = chrome.runtime.getURL('bookmarks.html');
  const [open] = await chrome.tabs.query({ url });
  if (open?.id != null) {
    await chrome.tabs.update(open.id, { active: true });
    if (open.windowId != null) {
      await chrome.windows.update(open.windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url });
}

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
