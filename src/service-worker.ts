import type { Settings } from '@/types';
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

type RuntimeMessage =
  | {
      type: 'PING_SERVICE_WORKER';
      payload?: undefined;
    }
  | {
      type: 'FETCH_WORK_ITEMS';
      payload: Settings;
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
    };

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

    if (message.type !== 'FETCH_WORK_ITEMS') {
      return;
    }

    resolveWorkItemsContext(message.payload)
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
