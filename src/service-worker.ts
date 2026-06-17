import type { FetchWorkItemsRequest, Settings } from '@/types';
import {
  LAST_VISITED_DEVOPS_CONTEXT_KEY,
  LAST_VISITED_WORK_ITEM_REF_KEY,
  parseLastVisitedDevOpsContext,
  parseLastVisitedWorkItemRef,
  tryCreateLastVisitedDevOpsContext,
  tryCreateLastVisitedWorkItemRef
} from './devops/lastVisitedContext';
import { fetchChildTasksForActiveParent } from './devops/childTasks';
import { resolveActiveWorkItemContext } from './devops/activeParentContext';
import { createChildTaskFromActivePage } from './devops/taskCreation';
import { fetchWorkItems } from './devops/workItems';
import { setParentForActiveWorkItem } from './devops/parentAssignment';
import { ensurePat } from './devops/auth/ensurePat';
import { revokeAllExtensionPats } from './devops/auth/revokeAllExtensionPats';
import { createDefaultConnectionService } from './devops/auth/connectionService';

type RuntimeMessage =
  | {
      type: 'PING_SERVICE_WORKER';
      payload?: undefined;
    }
  | {
      type: 'FETCH_WORK_ITEMS';
      payload: FetchWorkItemsRequest;
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

  // Pull-driven reconnect: when an Azure DevOps tab finishes loading, attempt one
  // automatic recovery. handleBearerCaptured no-ops unless we're disconnected, and
  // pulls the Bearer via readBearerFromTab — a reliable trigger that doesn't depend
  // on the racy main-world postMessage relay. See ADR 0002.
  if (
    changeInfo.status === 'complete' &&
    tab.url?.startsWith('https://dev.azure.com/')
  ) {
    void connectionService.handleBearerCaptured();
  }
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'PING_SERVICE_WORKER') {
      sendResponse({ ok: true, result: 'pong' });
      return;
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
