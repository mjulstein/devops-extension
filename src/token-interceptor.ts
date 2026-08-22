// Runs in the main world at document_start on dev.azure.com pages.
// Captures the Bearer token from the page's own API calls and stashes it on
// window.__devopsExtCapturedAuth so the service worker can read it (via
// executeScript) to mint/rotate the PAT.
//
// Capture scope: both vssps.dev.azure.com AND dev.azure.com — the latter is
// called on every page load (work items, boards, etc.) and carries the same
// Azure AD Bearer token, so it fires reliably even on pages that never touch vssps.
//
// Injection scope: vssps.dev.azure.com only — calls there may not carry cookies,
// so we re-attach the captured auth. dev.azure.com calls already carry full auth.
//
// The Authorization header is read off a Request passed as `input` as well as
// off `init.headers`: `fetch(new Request(url, { headers }))` is common and
// reading only `init.headers` misses it entirely.
//
// This is a best-effort fallback. Azure DevOps issues its authorized calls from
// a realm this patch does not reach, so the primary capture path is
// devops/auth/bearerObserver.ts, which observes headers at the network layer and
// is indifferent to the calling realm.

(function () {
  let capturedAuth: string | null = null;
  let lastSignaled: string | null = null;
  const VSSPS = 'vssps.dev.azure.com';
  const DEVOPS = 'dev.azure.com';
  const WINDOW_KEY = '__devopsExtCapturedAuth';
  // Lets readBearerFromTab distinguish "interceptor never ran" from
  // "interceptor ran but saw no Bearer" — otherwise both look identical.
  const INSTALLED_KEY = '__devopsExtInterceptorInstalled';
  const SIGNAL_SOURCE = 'devops-ext-token-interceptor';
  const globalObject = window as unknown as Record<string, unknown>;

  if (globalObject[INSTALLED_KEY]) {
    return;
  }
  globalObject[INSTALLED_KEY] = true;

  const origFetch = window.fetch.bind(window);

  function storeAndSignal(auth: string): void {
    capturedAuth = auth;
    globalObject[WINDOW_KEY] = auth;
    if (auth !== lastSignaled) {
      lastSignaled = auth;
      window.postMessage(
        { source: SIGNAL_SOURCE, type: 'bearer-captured' },
        '*'
      );
    }
  }

  function captureIfBearer(value: string | null | undefined): void {
    if (typeof value === 'string' && value.startsWith('Bearer ')) {
      storeAndSignal(value);
    }
  }

  function isRelevantUrl(url: string): { vssps: boolean; devops: boolean } {
    const vssps = url.includes(VSSPS);
    return { vssps, devops: !vssps && url.includes(DEVOPS) };
  }

  // ---------------------------------------------------------------- fetch
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const { vssps, devops } = isRelevantUrl(url);
    if (!vssps && !devops) {
      return origFetch(input, init);
    }

    // The header may live on `init` OR on a Request passed as `input`.
    const initAuth = init?.headers
      ? new Headers(init.headers).get('Authorization')
      : null;
    const requestAuth =
      !initAuth && typeof Request !== 'undefined' && input instanceof Request
        ? input.headers.get('Authorization')
        : null;
    const auth = initAuth ?? requestAuth;

    captureIfBearer(auth);

    // Inject the captured token into vssps calls that arrive without one.
    // (dev.azure.com calls already carry full browser auth — don't touch them.)
    if (vssps && !auth && capturedAuth) {
      if (typeof Request !== 'undefined' && input instanceof Request) {
        const cloned = new Request(input, {});
        cloned.headers.set('Authorization', capturedAuth);
        return origFetch(cloned);
      }
      const merged = new Headers(init?.headers);
      merged.set('Authorization', capturedAuth);
      return origFetch(input, { ...init, headers: merged });
    }

    return origFetch(input, init);
  };
})();
