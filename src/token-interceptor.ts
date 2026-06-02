// Runs in the main world at document_start on dev.azure.com pages.
// Wraps window.fetch to capture the Bearer token from the page's own API calls.
// Captured token is stashed on window.__devopsExtCapturedAuth so the service
// worker can read it (via executeScript) to mint/rotate the PAT.
//
// Capture scope: both vssps.dev.azure.com AND dev.azure.com — the latter is
// called on every page load (work items, boards, etc.) and carries the same
// Azure AD Bearer token, so it fires reliably even on pages that never touch vssps.
//
// Injection scope: vssps.dev.azure.com only — calls there may not carry cookies,
// so we re-attach the captured auth. dev.azure.com calls already carry full auth.

(function () {
  let capturedAuth: string | null = null;
  let lastSignaled: string | null = null;
  const VSSPS = 'vssps.dev.azure.com';
  const DEVOPS = 'dev.azure.com';
  const WINDOW_KEY = '__devopsExtCapturedAuth';
  const SIGNAL_SOURCE = 'devops-ext-token-interceptor';
  const origFetch = window.fetch.bind(window);

  function storeAndSignal(auth: string): void {
    capturedAuth = auth;
    (window as unknown as Record<string, unknown>)[WINDOW_KEY] = auth;
    if (auth !== lastSignaled) {
      lastSignaled = auth;
      window.postMessage(
        { source: SIGNAL_SOURCE, type: 'bearer-captured' },
        '*'
      );
    }
  }

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

    const isVssps = url.includes(VSSPS);
    const isDevops = !isVssps && url.includes(DEVOPS);

    if (!isVssps && !isDevops) {
      return origFetch(input, init);
    }

    const hdrs = new Headers(init?.headers);
    const auth = hdrs.get('Authorization');

    if (auth?.startsWith('Bearer ')) {
      storeAndSignal(auth);
    }

    // Inject the captured token into vssps calls that arrive without one.
    // (dev.azure.com calls already carry full browser auth — don't touch them.)
    if (isVssps && !auth && capturedAuth) {
      const merged = new Headers(init?.headers);
      merged.set('Authorization', capturedAuth);
      return origFetch(input, { ...init, headers: merged });
    }

    return origFetch(input, init);
  };
})();
