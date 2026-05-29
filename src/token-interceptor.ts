// Runs in the main world at document_start on dev.azure.com pages.
// Wraps window.fetch to capture Bearer tokens from the page's own API calls
// to vssps.dev.azure.com, then auto-injects them into unauthenticated requests
// from our injected mainWorldPatHandler.

(function () {
  let capturedAuth: string | null = null;
  const VSSPS = 'vssps.dev.azure.com';
  const WINDOW_KEY = '__devopsExtCapturedAuth';
  const origFetch = window.fetch.bind(window);

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (!url.includes(VSSPS)) {
      return origFetch(input, init);
    }

    const hdrs = new Headers(init?.headers);
    const auth = hdrs.get('Authorization');

    if (auth?.startsWith('Bearer ')) {
      capturedAuth = auth;
      (window as Record<string, unknown>)[WINDOW_KEY] = auth;
      return origFetch(input, init);
    }

    if (!auth && capturedAuth) {
      const merged = new Headers(init?.headers);
      merged.set('Authorization', capturedAuth);
      return origFetch(input, { ...init, headers: merged });
    }

    return origFetch(input, init);
  };
})();
