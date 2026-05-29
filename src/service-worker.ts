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
import { parsePatRecord, PAT_RECORD_KEY, DEVICE_ID_KEY } from './devops/patLifecycle';

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
    };

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void seedLastVisitedFromActiveTab();
});

chrome.runtime.onStartup.addListener(() => {
  void seedLastVisitedFromActiveTab();
  void tryRotatePatOnStartup();
});

void seedLastVisitedFromActiveTab();
void tryRotatePatOnStartup();

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

    if (message.type === 'ROTATE_PAT') {
      const { organization } = message.payload;
      proxyPatOperation({ action: 'ensure', organization })
        .then((record) => sendResponse({ ok: true, result: record }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'REVOKE_ALL_EXTENSION_PATS') {
      const { organization } = message.payload;
      proxyPatOperation({ action: 'revoke-all', organization })
        .then((count) => sendResponse({ ok: true, result: count }))
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

async function findAdoTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://dev.azure.com/*' });
  return tabs[0]?.id ?? null;
}

// Self-contained: runs in the page's main world where window.fetch carries the MSAL Bearer token.
// Must not reference any module-level imports or outer-scope variables.
async function mainWorldPatHandler(
  payload: { action: string; organization: string },
  storedPat: unknown,
  storedDeviceId: string | null
): Promise<{
  ok: boolean;
  data?: unknown;
  storageSet?: Record<string, unknown>;
  storageRemove?: string[];
  error?: string;
}> {
  const PAT_SUFFIX = '-devopsext';
  const PAT_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;
  const PAT_ROTATION_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
  const PAT_API_VERSION = '7.1-preview.1';
  const PAT_SCOPE = 'vso.work_write';
  const TIMEOUT_MS = 15_000;

  const { action, organization } = payload;

  function patListUrl(org: string): string {
    return `https://vssps.dev.azure.com/${encodeURIComponent(org)}/_apis/tokens/pats?api-version=${PAT_API_VERSION}`;
  }

  async function patFetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }

  function parsePat(v: unknown): { token: string; authorizationId: string; expiresAt: number; displayName: string } | null {
    if (typeof v !== 'object' || v === null) return null;
    const r = v as Record<string, unknown>;
    if (typeof r.token !== 'string' || typeof r.authorizationId !== 'string' ||
        typeof r.expiresAt !== 'number' || typeof r.displayName !== 'string') return null;
    return { token: r.token, authorizationId: r.authorizationId, expiresAt: r.expiresAt, displayName: r.displayName };
  }

  function extractCreated(data: unknown): { token?: string; authorizationId: string; validTo: string } | null {
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.patToken !== 'object' || d.patToken === null) return null;
    const pt = d.patToken as Record<string, unknown>;
    if (typeof pt.authorizationId !== 'string' || typeof pt.validTo !== 'string') return null;
    return { token: typeof pt.token === 'string' ? pt.token : undefined, authorizationId: pt.authorizationId, validTo: pt.validTo };
  }

  async function listExtPats(org: string): Promise<Array<{ displayName: string; authorizationId: string }>> {
    const result: Array<{ displayName: string; authorizationId: string }> = [];
    let ct: string | null = null;
    do {
      const url = ct ? `${patListUrl(org)}&continuationToken=${encodeURIComponent(ct)}` : patListUrl(org);
      const res = await patFetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) break;
      const data = await res.json() as Record<string, unknown>;
      if (!Array.isArray(data.patTokens)) break;
      for (const item of data.patTokens as unknown[]) {
        if (typeof item === 'object' && item !== null) {
          const i = item as Record<string, unknown>;
          if (typeof i.displayName === 'string' && i.displayName.endsWith(PAT_SUFFIX) && typeof i.authorizationId === 'string') {
            result.push({ displayName: i.displayName, authorizationId: i.authorizationId });
          }
        }
      }
      ct = typeof data.continuationToken === 'string' ? data.continuationToken : null;
    } while (ct);
    return result;
  }

  async function revoke(org: string, authorizationId: string): Promise<void> {
    const url = `https://vssps.dev.azure.com/${encodeURIComponent(org)}/_apis/tokens/pats` +
      `?authorizationId=${encodeURIComponent(authorizationId)}&api-version=${PAT_API_VERSION}`;
    await patFetch(url, { method: 'DELETE' }).catch(() => undefined);
  }

  const storageSet: Record<string, unknown> = {};
  const storageRemove: string[] = [];

  let deviceId = storedDeviceId;
  if (!deviceId) {
    deviceId = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    storageSet['devopsExtDeviceId'] = deviceId;
  }
  const displayName = `${deviceId}${PAT_SUFFIX}`;

  // Check that token-interceptor.ts has captured a Bearer token from this ADO
  // tab. If not, patFetch calls would go unauthenticated and get HTML back.
  const WINDOW_KEY = '__devopsExtCapturedAuth';
  if (!(window as Record<string, unknown>)[WINDOW_KEY]) {
    return {
      ok: false,
      error:
        'Azure DevOps authentication token not yet captured. ' +
        'Refresh the dev.azure.com tab and wait for the page to fully load, then try again.'
    };
  }

  try {
    if (action === 'ensure') {
      const existing = parsePat(storedPat);

      if (existing && existing.expiresAt - Date.now() > PAT_ROTATION_THRESHOLD_MS) {
        return { ok: true, data: existing };
      }

      if (existing) {
        try {
          const validTo = new Date(Date.now() + PAT_VALIDITY_MS).toISOString();
          const res = await patFetch(patListUrl(organization), {
            method: 'PUT',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorizationId: existing.authorizationId, displayName: existing.displayName, scope: PAT_SCOPE, validTo, allOrgs: false }),
          });
          if (res.ok) {
            const renewed = { ...existing, expiresAt: new Date(validTo).getTime() };
            storageSet['devopsExtPat'] = renewed;
            return { ok: true, data: renewed, storageSet };
          }
        } catch {
          // fall through to fresh create
        }
      }

      try {
        const remote = await listExtPats(organization);
        const match = remote.find((p) => p.displayName === displayName);
        if (match) await revoke(organization, match.authorizationId);
      } catch {
        // proceed to create anyway
      }

      const validTo = new Date(Date.now() + PAT_VALIDITY_MS).toISOString();
      const createRes = await patFetch(patListUrl(organization), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, scope: PAT_SCOPE, validTo, allOrgs: false }),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        return { ok: false, error: `PAT creation failed: HTTP ${createRes.status}\n${text}` };
      }

      const contentType = createRes.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return { ok: false, error: 'PAT creation failed: Azure DevOps returned a non-JSON response — the active tab may not be signed in to the right account.' };
      }

      const pat = extractCreated(await createRes.json() as unknown);
      if (!pat?.token) return { ok: false, error: 'PAT creation response missing token.' };

      const fresh = { token: pat.token, authorizationId: pat.authorizationId, expiresAt: new Date(pat.validTo).getTime(), displayName };
      storageSet['devopsExtPat'] = fresh;
      return { ok: true, data: fresh, storageSet };

    } else if (action === 'revoke-all') {
      const pats = await listExtPats(organization);
      await Promise.all(pats.map((p) => revoke(organization, p.authorizationId)));
      storageRemove.push('devopsExtPat');
      return { ok: true, data: pats.length, storageRemove };
    }

    return { ok: false, error: 'Unknown PAT action.' };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function proxyPatOperation(
  payload: { action: 'ensure'; organization: string } | { action: 'revoke-all'; organization: string }
): Promise<unknown> {
  const tabId = await findAdoTabId();
  if (!tabId) {
    throw new Error('Open an Azure DevOps tab to set up or rotate authentication.');
  }

  const stored = await chrome.storage.local.get([PAT_RECORD_KEY, DEVICE_ID_KEY]);

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: mainWorldPatHandler,
    args: [payload, stored[PAT_RECORD_KEY] ?? null, stored[DEVICE_ID_KEY] ?? null],
  });

  const result = results[0]?.result as {
    ok: boolean;
    data?: unknown;
    storageSet?: Record<string, unknown>;
    storageRemove?: string[];
    error?: string;
  };

  if (!result?.ok) {
    throw new Error(result?.error ?? 'PAT operation failed.');
  }

  if (result.storageSet && Object.keys(result.storageSet).length > 0) {
    await chrome.storage.local.set(result.storageSet);
  }
  if (result.storageRemove && result.storageRemove.length > 0) {
    await chrome.storage.local.remove(result.storageRemove);
  }

  return result.data;
}

async function tryRotatePatOnStartup(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get([
      LAST_VISITED_DEVOPS_CONTEXT_KEY,
      PAT_RECORD_KEY
    ]);

    const lastVisited = parseLastVisitedDevOpsContext(
      stored[LAST_VISITED_DEVOPS_CONTEXT_KEY]
    );
    if (!lastVisited) {
      return;
    }

    const existing = parsePatRecord(stored[PAT_RECORD_KEY]);
    const rotationThresholdMs = 7 * 24 * 60 * 60 * 1000;
    if (existing && existing.expiresAt - Date.now() > rotationThresholdMs) {
      return;
    }

    await proxyPatOperation({ action: 'ensure', organization: lastVisited.organization });
  } catch {
    // Rotation failure on startup is non-critical — the PAT may still be valid
  }
}
