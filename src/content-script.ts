import { initTabIcons, rescrapeTabIcons } from './devops/tabIcons';
import { resolveActiveWorkItemContext } from './devops/activeParentContext';
import { fetchChildTasksForActiveParent } from './devops/childTasks';
import { createChildTaskFromActivePage } from './devops/taskCreation';
import { setParentForActiveWorkItem } from './devops/parentAssignment';
import { detectActiveWorkItemId } from './devops/activeWorkItemDom';
import { readAdoThemeColorsFromPage } from './devops/pageTheme';
import { openFavoritesPalette } from './favoritesPalette/favoritesPalette';
import type { StarredPage } from './sidepanel/starredPages';
import type { WidenedSearchData } from './sidepanel/favoritesListing';
type RuntimeMessage =
  | {
      type: 'REFRESH_TAB_ICONS';
      payload?: undefined;
    }
  | {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT';
      payload?: {
        forceResync?: boolean;
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
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT';
      payload?: {
        preferredParentId?: number;
      };
    }
  | {
      type: 'SET_ACTIVE_WORK_ITEM_PARENT';
      payload: {
        parentId: number;
      };
    }
  | {
      type: 'READ_ADO_THEME_COLORS';
      payload?: undefined;
    }
  | {
      type: 'OPEN_FAVORITES_PALETTE';
      payload: {
        favorites: StarredPage[];
        quickTasks?: StarredPage[];
        tokens?: Record<string, string>;
        icons?: Record<string, string>;
      };
    };

initTabIcons();

function relayBearerCaptured(): void {
  void chrome.runtime
    .sendMessage({ type: 'DEVOPS_BEARER_CAPTURED' })
    .catch(() => undefined);
}

// If the token interceptor already captured a bearer before this content script
// reached document_idle, relay it now — the window.postMessage from that capture
// fired before our listener existed and was lost.
if (
  typeof (window as unknown as Record<string, unknown>)
    .__devopsExtCapturedAuth === 'string'
) {
  relayBearerCaptured();
}

// Relay the main-world token-interceptor's fresh-Bearer signal to the service
// worker, which has no access to the page's main world. The interceptor posts on
// window; we forward as a runtime message (spec FR-008, plan Phase 4).
window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }
  const data = event.data as { source?: unknown; type?: unknown } | undefined;
  if (
    data?.source !== 'devops-ext-token-interceptor' ||
    data.type !== 'bearer-captured'
  ) {
    return;
  }
  relayBearerCaptured();
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'OPEN_FAVORITES_PALETTE') {
      // The palette is drawn here rather than in the side panel because this
      // document has focus, so its search field can simply take it.
      openFavoritesPalette({
        favorites: message.payload.favorites,
        quickTasks: message.payload.quickTasks,
        tokens: message.payload.tokens,
        icons: message.payload.icons,
        searchAllBookmarks: async (term: string) => {
          const response: {
            ok: boolean;
            result?: WidenedSearchData & { icons: Record<string, string> };
          } = await chrome.runtime.sendMessage({
            type: 'SEARCH_BOOKMARKS',
            payload: { term }
          });
          return response.ok && response.result
            ? response.result
            : { bookmarks: [], folders: [], icons: {} };
        },
        onOpenBookmarkManager: () => {
          void chrome.runtime.sendMessage({ type: 'OPEN_BOOKMARK_MANAGER' });
        },
        onOpenPage: (url, newTab) => {
          void chrome.runtime.sendMessage({
            type: 'OPEN_STARRED_PAGE',
            payload: { url, newTab }
          });
        }
      });
      sendResponse({ ok: true, result: null });
      return false;
    }

    if (message.type === 'READ_ADO_THEME_COLORS') {
      // Only the page knows what Azure DevOps's current theme actually is.
      sendResponse({ ok: true, result: readAdoThemeColorsFromPage() });
      return false;
    }

    if (message.type === 'REFRESH_TAB_ICONS') {
      rescrapeTabIcons()
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'GET_ACTIVE_WORK_ITEM_CONTEXT') {
      const detectedWorkItemId = detectActiveWorkItemId(
        Boolean(message.payload?.forceResync)
      );

      resolveActiveWorkItemContext(
        window.location.href,
        undefined,
        detectedWorkItemId
      )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'CREATE_CHILD_TASK') {
      createChildTaskFromActivePage(
        message.payload.title,
        window.location.href,
        message.payload.preferredParentId
      )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT') {
      fetchChildTasksForActiveParent(
        window.location.href,
        message.payload?.preferredParentId
      )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'SET_ACTIVE_WORK_ITEM_PARENT') {
      setParentForActiveWorkItem(window.location.href, message.payload.parentId)
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }
  }
);
