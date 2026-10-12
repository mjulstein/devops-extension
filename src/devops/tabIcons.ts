import {
  FALLBACK_ICONS,
  SCRAPABLE_SECTIONS,
  SECTION_NAV_SELECTORS,
  TAB_ICON_STORAGE_KEY as STORAGE_KEY,
  detectSection,
  type DevOpsSection
} from './sectionIcons';

// In-memory cache: section → CDN URL or data URI
const iconCache = new Map<DevOpsSection, string>();

// ── Storage ──────────────────────────────────────────────────────────────────

async function loadCachedIcons(): Promise<void> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const stored = data[STORAGE_KEY] as Record<string, string> | undefined;
  if (!stored) return;
  for (const [section, url] of Object.entries(stored)) {
    iconCache.set(section as DevOpsSection, url);
  }
}

async function saveCachedIcons(): Promise<void> {
  const obj: Record<string, string> = {};
  for (const [section, url] of iconCache) obj[section] = url;
  await chrome.storage.local.set({ [STORAGE_KEY]: obj });
}

// ── DOM scraping ─────────────────────────────────────────────────────────────

function scrapeNavIcon(section: DevOpsSection): string | null {
  const selector = SECTION_NAV_SELECTORS[section];
  if (!selector) return null;

  const link = document.querySelector<HTMLAnchorElement>(selector);
  if (!link) return null;

  // The nav uses <img class="contributed-icon"> whose src is the CDN URL
  const img = link.querySelector<HTMLImageElement>('img');
  if (img?.src && !img.src.startsWith('data:')) return img.src;

  // Fallback: inline SVG (less common but handle it)
  const svg = link.querySelector('svg');
  if (svg) {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('width')) clone.setAttribute('width', '16');
    if (!clone.getAttribute('height')) clone.setAttribute('height', '16');
    return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  }

  return null;
}

function refreshIconCache(): void {
  let added = 0;
  for (const section of SCRAPABLE_SECTIONS) {
    if (iconCache.has(section)) continue;
    const icon = scrapeNavIcon(section);
    if (icon) {
      iconCache.set(section, icon);
      added++;
    }
  }
  if (added > 0) void saveCachedIcons();
}

// ── Favicon management ───────────────────────────────────────────────────────

// Watches <head> so we can restore our favicon if Azure DevOps overwrites it
let faviconGuard: MutationObserver | null = null;
let currentIconUrl: string | null = null;

/**
 * A budget on how often the guard may repaint before it gives up.
 *
 * The guard reacts to a favicon it did not write by writing its own. Anything
 * else on the page that does the same thing — another copy of this script left
 * behind by an extension reload, or Azure DevOps itself — turns that into two
 * observers repainting each other's work without pause, which locks the tab up
 * and eventually kills it. A favicon is cosmetic and a hung tab is not, so past
 * this budget the guard stops rather than wins.
 */
const GUARD_REPAINT_BUDGET = 40;
const GUARD_WINDOW_MS = 2000;
let repaintCount = 0;
let repaintWindowStart = 0;

/** True while the guard still has budget; disconnects it when it runs out. */
function guardMayRepaint(): boolean {
  const now = Date.now();
  if (now - repaintWindowStart > GUARD_WINDOW_MS) {
    repaintWindowStart = now;
    repaintCount = 0;
  }
  repaintCount += 1;
  if (repaintCount <= GUARD_REPAINT_BUDGET) {
    return true;
  }
  faviconGuard?.disconnect();
  faviconGuard = null;
  console.warn(
    '[devops-extension] favicon guard stood down: something else on the page keeps rewriting the favicon.'
  );
  return false;
}

function isFaviconLink(el: Element): el is HTMLLinkElement {
  if (!(el instanceof HTMLLinkElement)) return false;
  const rel = (el.getAttribute('rel') ?? '').toLowerCase();
  return rel === 'icon' || rel === 'shortcut icon';
}

function setFavicon(url: string): void {
  currentIconUrl = url;

  // Disconnect guard while we mutate so we don't trigger ourselves
  faviconGuard?.disconnect();

  for (const el of Array.from(document.querySelectorAll('link'))) {
    if (isFaviconLink(el)) el.remove();
  }

  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = url;
  document.head.appendChild(link);

  // Reconnect after the current call stack so Azure DevOps React renders first,
  // then any subsequent override attempt is caught immediately.
  if (faviconGuard) {
    faviconGuard.observe(document.head, { childList: true, subtree: true });
  }
}

function startFaviconGuard(): void {
  faviconGuard = new MutationObserver(() => {
    if (!currentIconUrl) return;
    const favicons = Array.from(document.querySelectorAll('link')).filter(
      isFaviconLink
    );
    // Re-evaluate from the current URL so mid-navigation overrides immediately
    // show the correct section rather than the previous one.
    if (favicons.length !== 1 || favicons[0].href !== currentIconUrl) {
      if (!guardMayRepaint()) return;
      applyFavicon();
    }
  });
  faviconGuard.observe(document.head, { childList: true, subtree: true });
}

function applyFavicon(): void {
  const section = detectSection(window.location.href);
  const url =
    iconCache.get(section) ??
    `data:image/svg+xml,${encodeURIComponent(FALLBACK_ICONS[section])}`;
  setFavicon(url);
}

// ── Nav readiness ────────────────────────────────────────────────────────────

function waitForNav(signal: AbortSignal): Promise<void> {
  // Any of these aria-label anchors confirm the sidebar has rendered
  const probe = SCRAPABLE_SECTIONS.map((s) => SECTION_NAV_SELECTORS[s]).join(
    ', '
  );

  return new Promise((resolve) => {
    if (document.querySelector(probe)) {
      resolve();
      return;
    }
    const obs = new MutationObserver(() => {
      if (document.querySelector(probe)) {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      obs.disconnect();
      resolve();
    }, 8000);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      obs.disconnect();
      resolve();
    });
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Everything this module attached to the page, so it can let go again.
 *
 * A content script cannot be unloaded, but it can be made inert — which is what
 * an extension reload needs. The copy left behind by the reload keeps running
 * its observers with no way to reach the extension any more, so it holds the
 * favicon it last computed forever while the fresh copy insists on its own. The
 * two then repaint each other until the tab dies. The fresh copy asks the old
 * one to stand down instead, and this is what answers that.
 */
let teardown: (() => void) | null = null;

export function teardownTabIcons(): void {
  teardown?.();
  teardown = null;
}

export function initTabIcons(): void {
  // A second init in one page would be a second set of observers fighting the
  // first, which is the failure this teardown exists to prevent.
  teardownTabIcons();

  const abort = new AbortController();
  const { signal } = abort;

  startFaviconGuard();
  applyFavicon();

  void (async () => {
    await loadCachedIcons();
    if (signal.aborted) return;
    applyFavicon();

    const missing = SCRAPABLE_SECTIONS.filter((s) => !iconCache.has(s));
    if (missing.length > 0) {
      await waitForNav(signal);
      if (signal.aborted) return;
      refreshIconCache();
      applyFavicon();
    }
  })();

  // Patch history so SPA navigation updates the favicon without a page reload
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const origPush = history.pushState;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const origReplace = history.replaceState;

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPush.apply(this, args);
    applyFavicon();
  };
  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ) {
    origReplace.apply(this, args);
    applyFavicon();
  };
  window.addEventListener('popstate', () => applyFavicon(), { signal });

  // Re-apply whenever the tab is switched back to — Azure DevOps may have
  // overwritten the favicon while the tab was in the background.
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'visible') {
        applyFavicon();
      }
    },
    { signal }
  );

  // Azure DevOps updates <title> early in every SPA navigation — before
  // history.pushState and long before the React render settles.  Observing
  // it gives us the fastest possible trigger for a section change.
  let titleHref = window.location.href;
  const titleObserver = new MutationObserver(() => {
    const href = window.location.href;
    if (href !== titleHref) {
      titleHref = href;
      applyFavicon();
    }
  });
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  teardown = () => {
    abort.abort();
    titleObserver.disconnect();
    faviconGuard?.disconnect();
    faviconGuard = null;
    currentIconUrl = null;
    // Restoring the patches matters as much as disconnecting: left in place they
    // chain, so after three reloads one navigation repaints three times.
    history.pushState = origPush;
    history.replaceState = origReplace;
  };
}

export async function rescrapeTabIcons(): Promise<void> {
  iconCache.clear();
  await chrome.storage.local.remove(STORAGE_KEY);
  refreshIconCache();
  applyFavicon();
}
