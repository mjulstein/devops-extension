// Captures the page's Azure DevOps Bearer token by observing outgoing request
// headers, rather than by patching page globals.
//
// Why not patch fetch/XHR: token-interceptor.ts wraps window.fetch and
// XMLHttpRequest in the page's main world, but Azure DevOps issues its
// authorized calls from a realm that patch never reaches — an install marker
// confirms the interceptor runs while the token is still never seen, and the
// requests themselves are plainly visible to devtools carrying `Authorization`.
// chrome.webRequest observes headers at the network layer, so it is indifferent
// to which realm (page, worker, iframe) made the call.
//
// This is observe-only (onSendHeaders is non-blocking and MV3-legal). Nothing is
// modified or redirected.
//
// The token is held in chrome.storage.session, which is memory-only and cleared
// when the browser closes — it must never reach disk.

const SESSION_BEARER_KEY = 'devopsExtObservedBearer';

const OBSERVED_URLS = [
  'https://dev.azure.com/*',
  'https://vssps.dev.azure.com/*'
];

interface ObservedBearer {
  value: string;
  observedAt: number;
}

/**
 * Starts observing. Safe to call on every service-worker start: listeners are
 * per-worker-instance, so a restart simply re-registers.
 */
export function startBearerObserver(): void {
  if (!chrome.webRequest?.onSendHeaders) {
    console.warn(
      '[bearerObserver] chrome.webRequest unavailable — the "webRequest" permission may be missing.'
    );
    return;
  }

  chrome.webRequest.onSendHeaders.addListener(
    (details) => {
      const header = details.requestHeaders?.find(
        (candidate) => candidate.name.toLowerCase() === 'authorization'
      );
      const value = header?.value;
      if (typeof value !== 'string' || !value.startsWith('Bearer ')) {
        return;
      }
      void writeObservedBearer(value);
    },
    { urls: OBSERVED_URLS },
    ['requestHeaders']
  );
}

async function writeObservedBearer(value: string): Promise<void> {
  try {
    const record: ObservedBearer = { value, observedAt: Date.now() };
    await chrome.storage.session.set({ [SESSION_BEARER_KEY]: record });
  } catch (error) {
    console.warn('[bearerObserver] could not store observed bearer', error);
  }
}

/** Most recently observed Bearer, or null. Freshness is judged by the caller. */
export async function readObservedBearer(): Promise<string | null> {
  try {
    const stored = await chrome.storage.session.get(SESSION_BEARER_KEY);
    const record = stored[SESSION_BEARER_KEY];
    if (
      record &&
      typeof record === 'object' &&
      typeof (record as ObservedBearer).value === 'string'
    ) {
      return (record as ObservedBearer).value;
    }
  } catch {
    /* session storage unavailable */
  }
  return null;
}

export { SESSION_BEARER_KEY };
