import { DEV_ORGANIZATION, DEV_PROJECT, SCENARIOS } from './scenarios';
import type { Scenario, ScenarioId } from './scenarios';

// Installs a fake `chrome` global so the real side-panel App can run in a plain
// browser tab under `vite` with HMR — no extension build, no reload.
//
// Only the surface the side panel actually touches is implemented. The panel
// reaches Azure DevOps exclusively through chrome.runtime.sendMessage, so a
// message router plus storage is enough to light up the whole UI.

const STORAGE_KEY = 'devharness.storage';
const SCENARIO_KEY = 'devharness.scenario';

export function readScenarioId(): ScenarioId {
  const stored = window.localStorage.getItem(SCENARIO_KEY);
  return stored && stored in SCENARIOS ? (stored as ScenarioId) : 'happy';
}

export function writeScenarioId(id: ScenarioId): void {
  window.localStorage.setItem(SCENARIO_KEY, id);
}

export function resetStorage(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

type StorageShape = Record<string, unknown>;

function readStore(): StorageShape {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}'
    );
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as StorageShape)
      : {};
  } catch {
    return {};
  }
}

function writeStore(next: StorageShape): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors chrome.storage.local.get overloads: null/undefined -> everything,
// string -> single key, string[] -> subset, object -> defaults merged under.
function getFromStore(
  query?: string | string[] | Record<string, unknown> | null
): Record<string, unknown> {
  const store = readStore();

  if (query === null || query === undefined) return { ...store };

  if (typeof query === 'string') {
    return query in store ? { [query]: store[query] } : {};
  }

  if (Array.isArray(query)) {
    const out: Record<string, unknown> = {};
    for (const key of query) if (key in store) out[key] = store[key];
    return out;
  }

  return { ...query, ...pick(store, Object.keys(query)) };
}

function pick(
  source: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

interface RuntimeMessage {
  type: string;
  payload?: unknown;
}

function ok<T>(result: T) {
  return { ok: true as const, result };
}

function fail(error: string) {
  return { ok: false as const, error };
}

let nextCreatedId = 5000;

async function route(
  message: RuntimeMessage,
  scenario: Scenario
): Promise<unknown> {
  await delay(scenario.latencyMs);

  // PING must always succeed — a failing ping reads as "service worker dead"
  // rather than as the data-layer error the scenario is trying to simulate.
  if (message.type === 'PING_SERVICE_WORKER') return ok(true);

  if (scenario.failWith) return fail(scenario.failWith);

  switch (message.type) {
    case 'ENSURE_CONNECTION':
    case 'RETRY_CONNECTION':
      return ok(scenario.connection);

    case 'FETCH_WORK_ITEMS':
      return ok(scenario.workItems);

    case 'GET_ACTIVE_WORK_ITEM_CONTEXT':
      return scenario.activeContext
        ? ok(scenario.activeContext)
        : fail('No active Azure DevOps work item view found.');

    case 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT':
      return ok(scenario.childTasks);

    case 'FETCH_AUTHORED_WORK_ITEMS':
      return ok(scenario.authoredItems);

    case 'FETCH_CLOSED_PARENT_ROLLUP':
      return ok(scenario.closedParentRollup);

    case 'FETCH_PULL_REQUEST_ACTIVITY':
      return ok(scenario.pullRequestActivity);

    case 'FETCH_QUICK_TASKS':
      return ok(scenario.quickTasks);

    case 'ARCHIVE_QUICK_TASK': {
      const { taskId } = (message.payload ?? {}) as { taskId?: number };
      console.info('[dev-harness] archived quick task', taskId);
      return ok(taskId ?? 0);
    }

    case 'CREATE_QUICK_TASK': {
      const { title } = (message.payload ?? {}) as { title?: string };
      const id = nextCreatedId++;
      return ok({
        id,
        title: title ?? 'Task from page',
        state: 'In Progress',
        url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_workitems/edit/${id}`,
        parentId: 1000
      });
    }

    case 'CREATE_CHILD_TASK': {
      const { title } = (message.payload ?? {}) as { title?: string };
      const id = nextCreatedId++;
      return ok({
        id,
        title: title ?? 'Untitled task',
        url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_workitems/edit/${id}`,
        parentId: scenario.activeContext?.parentId ?? 1000
      });
    }

    case 'SET_ACTIVE_WORK_ITEM_PARENT':
      return ok(true);

    case 'ROTATE_PAT':
      return ok({
        token: 'dev-harness-fake-pat',
        authorizationId: 'dev-harness',
        displayName: 'devharness-devopsext',
        validTo: new Date(Date.now() + 86_400_000).toISOString()
      });

    case 'REVOKE_ALL_EXTENSION_PATS':
      return ok(1);

    case 'REFRESH_TAB_ICONS':
      return ok(true);

    default:
      console.warn('[dev-harness] unrouted message', message);
      return fail(`Dev harness has no route for "${message.type}".`);
  }
}

function noopEvent() {
  return { addListener: () => {}, removeListener: () => {} };
}

/** A dispatchable event, so the harness can simulate what the browser raises. */
function fakeEvent<Args extends unknown[]>() {
  const listeners = new Set<(...args: Args) => void>();
  return {
    addListener: (listener: (...args: Args) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (...args: Args) => void) => {
      listeners.delete(listener);
    },
    dispatch: (...args: Args) => {
      for (const listener of listeners) listener(...args);
    }
  };
}

interface FakeBookmark {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
}

/**
 * In-memory bookmarks, with dispatchable events.
 *
 * The two-way favorites sync is unreachable without this: `chrome.bookmarks`
 * being absent reads as "permission denied", so the harness could neither write
 * the folder nor act on a change arriving from another machine.
 */
function createBookmarksMock() {
  // Root ids are deliberately not "0"/"1"/"2": hardcoding Chrome's numbering is
  // what broke the real mirror in Edge, and the harness should not re-teach it.
  const nodes = new Map<string, FakeBookmark>([
    ['root', { id: 'root', title: '' }],
    ['bar', { id: 'bar', parentId: 'root', title: 'Bookmarks bar' }],
    ['other', { id: 'other', parentId: 'root', title: 'Other favorites' }]
  ]);
  let nextId = 100;

  const onCreated = fakeEvent<[string, FakeBookmark]>();
  const onChanged = fakeEvent<[string, { title?: string; url?: string }]>();
  const onRemoved = fakeEvent<[string, { parentId?: string }]>();
  const onMoved = fakeEvent<[string, Record<string, unknown>]>();

  function childrenOf(parentId: string): FakeBookmark[] {
    return [...nodes.values()].filter((node) => node.parentId === parentId);
  }

  function subtree(id: string): FakeBookmark & { children?: FakeBookmark[] } {
    const node = nodes.get(id);
    if (!node) throw new Error(`No bookmark ${id}`);
    const children = childrenOf(id);
    return children.length > 0 || !node.url
      ? { ...node, children: children.map((child) => subtree(child.id)) }
      : { ...node };
  }

  const api = {
    getTree: async () => [subtree('root')],
    getChildren: async (id: string) => childrenOf(id).map((node) => ({ ...node })),
    create: async (info: { parentId?: string; title?: string; url?: string }) => {
      const parentId = info.parentId ?? 'other';
      if (!nodes.has(parentId)) throw new Error(`Can't write to ${parentId}`);
      const id = String(nextId++);
      const node: FakeBookmark = {
        id,
        parentId,
        title: info.title ?? '',
        url: info.url
      };
      nodes.set(id, node);
      onCreated.dispatch(id, node);
      return { ...node };
    },
    update: async (id: string, changes: { title?: string; url?: string }) => {
      const node = nodes.get(id);
      if (!node) throw new Error(`No bookmark ${id}`);
      if (changes.title !== undefined) node.title = changes.title;
      if (changes.url !== undefined) node.url = changes.url;
      onChanged.dispatch(id, changes);
      return { ...node };
    },
    remove: async (id: string) => {
      const node = nodes.get(id);
      if (!node) throw new Error(`No bookmark ${id}`);
      nodes.delete(id);
      onRemoved.dispatch(id, { parentId: node.parentId });
    },
    onCreated,
    onChanged,
    onRemoved,
    onMoved
  };

  return { api, nodes, childrenOf };
}

export function installMockChrome(getScenario: () => Scenario): void {
  const bookmarks = createBookmarksMock();
  const fakeTab = {
    id: 1,
    windowId: 1,
    active: true,
    url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_workitems/edit/1001`,
    title: 'Azure DevOps (dev harness)'
  };

  const mock = {
    storage: {
      local: {
        get: async (query?: string | string[] | Record<string, unknown> | null) =>
          getFromStore(query),
        set: async (values: Record<string, unknown>) => {
          writeStore({ ...readStore(), ...values });
        },
        remove: async (keys: string | string[]) => {
          const store = readStore();
          for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
          writeStore(store);
        },
        clear: async () => writeStore({})
      },
      onChanged: noopEvent()
    },
    runtime: {
      id: 'dev-harness',
      sendMessage: (message: RuntimeMessage) => route(message, getScenario()),
      onMessage: noopEvent(),
      onStartup: noopEvent(),
      onInstalled: noopEvent(),
      reload: () => window.location.reload(),
      lastError: undefined
    },
    tabs: {
      query: async () => [fakeTab],
      get: async () => fakeTab,
      create: async (info: { url?: string }) => {
        console.info('[dev-harness] tabs.create', info.url);
        return { ...fakeTab, id: 2 };
      },
      update: async (...args: unknown[]) => {
        console.info('[dev-harness] tabs.update', args);
        return fakeTab;
      },
      remove: async (ids: number | number[]) => {
        console.info('[dev-harness] tabs.remove', ids);
      },
      sendMessage: (_id: number, message: RuntimeMessage) =>
        route(message, getScenario()),
      onUpdated: noopEvent(),
      onActivated: noopEvent()
    },
    windows: {
      update: async () => ({ id: 1 })
    },
    scripting: {
      executeScript: async () => [{ result: null }]
    },
    sidePanel: {
      setPanelBehavior: async () => {}
    },
    bookmarks: bookmarks.api
  };

  (globalThis as unknown as { chrome: unknown }).chrome = mock;

  // Exposed so the toolbar (and a CDP session) can act as "another machine":
  // change the folder behind the panel's back and see whether it notices.
  (
    globalThis as unknown as { devBookmarks: unknown }
  ).devBookmarks = {
    list: (folderName: string) => {
      const folder = [...bookmarks.nodes.values()].find(
        (node) => !node.url && node.title === folderName
      );
      return folder ? bookmarks.childrenOf(folder.id) : [];
    },
    /** Simulates a favorite arriving from another machine over bookmark sync. */
    syncIn: async (folderName: string, title: string, url: string) => {
      let folder = [...bookmarks.nodes.values()].find(
        (node) => !node.url && node.title === folderName
      );
      folder ??= await bookmarks.api.create({
        parentId: 'other',
        title: folderName
      });
      return bookmarks.api.create({ parentId: folder.id, title, url });
    },
    renameRemotely: (id: string, title: string) =>
      bookmarks.api.update(id, { title }),
    removeRemotely: (id: string) => bookmarks.api.remove(id)
  };
}
