// Reads the Bearer token that token-interceptor.ts captured in an Azure DevOps
// tab's main world. This is the *only* code the lifecycle runs in the page — a
// one-line read of the window key. Everything else runs in the service worker.
//
// Returns null when it cannot obtain a token: no Azure DevOps tab, nothing
// captured yet, or no access to chrome.scripting (e.g. a content-script context,
// which cannot call executeScript). Freshness is judged by the caller.

const CAPTURED_AUTH_WINDOW_KEY = '__devopsExtCapturedAuth';

// Per-tab timeout: frozen/suspended background tabs can cause executeScript to hang
// indefinitely (observed in Edge MV3). 4 s is generous for an active tab.
const EXECUTE_SCRIPT_TIMEOUT_MS = 4_000;

// Read the captured bearer from any open Azure DevOps tab. All tabs are queried
// in parallel so a frozen tab (common with many background tabs) does not block
// the result from a tab that is actually responsive.
export async function readBearerFromTab(): Promise<string | null> {
  if (!chrome.scripting?.executeScript || !chrome.tabs?.query) {
    return null;
  }

  const tabs = await chrome.tabs.query({ url: 'https://dev.azure.com/*' });
  const tabIds = tabs.map((t) => t.id).filter((id): id is number => id != null);

  if (tabIds.length === 0) {
    return null;
  }

  const results = await Promise.all(
    tabIds.map((tabId) =>
      Promise.race([
        chrome.scripting
          .executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () =>
              (window as unknown as { __devopsExtCapturedAuth?: unknown })
                .__devopsExtCapturedAuth ?? null
          })
          .then((r) => r[0]?.result ?? null),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), EXECUTE_SCRIPT_TIMEOUT_MS)
        )
      ]).catch(() => null)
    )
  );

  const bearer = results.find((r): r is string => typeof r === 'string');
  return bearer ?? null;
}

export { CAPTURED_AUTH_WINDOW_KEY };
