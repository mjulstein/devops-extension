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
// Both fetch and XMLHttpRequest are wrapped. Azure DevOps issues its authorized
// calls through fetch, but frequently as `fetch(new Request(url, { headers }))`
// with no second argument — so the Authorization header must be read off the
// Request object as well as off `init`. Reading only `init.headers` silently
// captures nothing on such pages.

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

  // ----------------------------------------------------- XMLHttpRequest
  // Belt and braces: any authorized call that goes through XHR instead of fetch
  // would otherwise be invisible.
  const XhrProto = XMLHttpRequest.prototype;
  const origOpen = XhrProto.open;
  const origSetRequestHeader = XhrProto.setRequestHeader;
  const URL_FLAG = '__devopsExtRelevantUrl';

  XhrProto.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const href = typeof url === 'string' ? url : url.href;
    const { vssps, devops } = isRelevantUrl(href);
    (this as unknown as Record<string, unknown>)[URL_FLAG] = vssps || devops;
    return (origOpen as (...args: unknown[]) => void).apply(this, [
      method,
      url,
      ...rest
    ]);
  } as typeof XhrProto.open;

  XhrProto.setRequestHeader = function (
    this: XMLHttpRequest,
    name: string,
    value: string
  ) {
    if (
      (this as unknown as Record<string, unknown>)[URL_FLAG] &&
      name.toLowerCase() === 'authorization'
    ) {
      captureIfBearer(value);
    }
    return origSetRequestHeader.call(this, name, value);
  };
})();
