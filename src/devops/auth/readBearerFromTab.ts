// Reads the Bearer token that token-interceptor.ts captured in an Azure DevOps
// tab's main world. This is the *only* code the lifecycle runs in the page — a
// one-line read of the window key. Everything else runs in the service worker.
//
// Returns null when it cannot obtain a token: no Azure DevOps tab, nothing
// captured yet, or no access to chrome.scripting (e.g. a content-script context,
// which cannot call executeScript). Freshness is judged by the caller.

import { readObservedBearer } from './bearerObserver';

const CAPTURED_AUTH_WINDOW_KEY = '__devopsExtCapturedAuth';

// Per-tab timeout: frozen/suspended background tabs can cause executeScript to hang
// indefinitely (observed in Edge MV3). 4 s is generous for an active tab.
const EXECUTE_SCRIPT_TIMEOUT_MS = 4_000;

// Read the captured bearer from any open Azure DevOps tab. All tabs are queried
// in parallel so a frozen tab (common with many background tabs) does not block
// the result from a tab that is actually responsive.
export async function readBearerFromTab(): Promise<string | null> {
  // Preferred source: headers observed at the network layer, which sees calls
  // from any realm. The in-page reads below remain as fallbacks.
  const observed = await readObservedBearer();
  if (observed) {
    return observed;
  }

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
            func: () => {
              const w = window as unknown as Record<string, unknown>;
              // The injected function runs in the tab's context, so module-level
              // constants are not available — use the literal key name directly.
              const captured = w.__devopsExtCapturedAuth;

              // Fall back to MSAL's token cache when the interceptor window key is
              // absent or stale. This covers two failure modes:
              //   1. The extension was installed while DevOps tabs were already open —
              //      Chrome doesn't re-inject content scripts into existing tabs, so
              //      token-interceptor.ts never ran and the key is undefined.
              //   2. The page has been idle long enough for Azure AD to silently refresh
              //      the token via a hidden MSAL iframe (not through window.fetch), so
              //      the key holds a now-expired token.
              // MSAL stores its cache in localStorage/sessionStorage and refreshes
              // proactively, so it always reflects the current session token.
              let msalSecret: string | null = null;
              let msalExp = 0;

              const storesToSearch: Storage[] = [];
              try {
                storesToSearch.push(localStorage);
              } catch {
                /* unavailable */
              }
              try {
                storesToSearch.push(sessionStorage);
              } catch {
                /* unavailable */
              }

              for (const store of storesToSearch) {
                try {
                  for (let i = 0; i < store.length; i++) {
                    const k = store.key(i);
                    if (!k?.toLowerCase().includes('accesstoken')) continue;
                    let item: unknown;
                    try {
                      item = JSON.parse(store.getItem(k) ?? '');
                    } catch {
                      continue;
                    }
                    if (
                      typeof item !== 'object' ||
                      item === null ||
                      (item as Record<string, unknown>).credentialType !==
                        'AccessToken' ||
                      typeof (item as Record<string, unknown>).secret !==
                        'string'
                    ) {
                      continue;
                    }
                    // Azure DevOps scopes use the "vso." prefix or management.visualstudio.com
                    const target = String(
                      (item as Record<string, string | number>).target ?? ''
                    );
                    if (
                      !target.includes('vso.') &&
                      !target.includes('management.visualstudio.com')
                    ) {
                      continue;
                    }
                    const exp = Number(
                      (item as Record<string, unknown>).expiresOn
                    );
                    if (!isNaN(exp) && exp > msalExp) {
                      msalSecret = (item as Record<string, unknown>)
                        .secret as string;
                      msalExp = exp;
                    }
                  }
                } catch {
                  /* skip this storage */
                }
              }

              if (msalSecret) {
                const fresh = `Bearer ${msalSecret}`;
                // Keep the interceptor window key in sync so VSSPS injection also uses the latest token
                w.__devopsExtCapturedAuth = fresh;
                return fresh;
              }

              if (typeof captured === 'string') {
                return captured;
              }

              // Nothing usable. Report *why* so the two very different failures
              // are distinguishable: the content script never ran in this tab
              // (needs a tab reload after install/update), versus it ran but the
              // page has not issued an authorized request yet.
              return w.__devopsExtInterceptorInstalled
                ? '@@no-bearer-captured-yet'
                : '@@interceptor-not-installed';
            }
          })
          .then((r) => r[0]?.result ?? null),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), EXECUTE_SCRIPT_TIMEOUT_MS)
        )
      ]).catch(() => null)
    )
  );

  const bearer = results.find(
    (r): r is string => typeof r === 'string' && !r.startsWith('@@')
  );

  if (bearer) {
    return bearer;
  }

  const diagnostics = results.filter(
    (r): r is string => typeof r === 'string' && r.startsWith('@@')
  );
  if (diagnostics.includes('@@interceptor-not-installed')) {
    console.warn(
      '[readBearerFromTab] token-interceptor is not installed in any Azure DevOps tab — ' +
        'reload the Azure DevOps tab so the content script is injected.'
    );
  } else if (diagnostics.length) {
    console.warn(
      '[readBearerFromTab] token-interceptor is installed but has captured no Bearer yet — ' +
        'the page may not have issued an authorized request since it loaded.'
    );
  }

  return null;
}

export { CAPTURED_AUTH_WINDOW_KEY };
