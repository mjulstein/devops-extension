type DevOpsSection =
  | 'overview'
  | 'boards'
  | 'repos'
  | 'pipelines'
  | 'testplans'
  | 'artifacts'
  | 'wiki'
  | 'settings';

const STORAGE_KEY = 'tabIconCache';

// URL path fragments used by detectSection (always lower-cased before comparison)
const SECTION_PATH_PATTERNS: Record<DevOpsSection, string[]> = {
  overview: [],
  boards: ['/_boards', '/_backlogs', '/_sprints', '/_queries', '/_workitems'],
  repos: ['/_git/', '/_versioncontrol/'],
  pipelines: ['/_build', '/_release', '/_pipelines'],
  testplans: ['/_testplans', '/_testmanagement'],
  artifacts: ['/_artifacts', '/_packaging'],
  wiki: ['/_wiki'],
  settings: ['/_settings']
};

// How each section's <a> is identified in the nav sidebar.
// Prefer aria-label (stable) over href fragment (case-sensitive in CSS selectors).
const SECTION_NAV_SELECTORS: Record<DevOpsSection, string> = {
  overview: 'a[aria-label="Overview"]',
  boards: 'a[aria-label="Boards"]',
  repos: 'a[aria-label="Repos"]',
  pipelines: 'a[aria-label="Pipelines"]',
  testplans: 'a[aria-label="Test Plans"]',
  artifacts: 'a[aria-label="Artifacts"]',
  wiki: 'a[aria-label="Wiki"]',
  settings: '' // uses an icon font, not scrape-able
};

const SCRAPABLE_SECTIONS = (
  Object.keys(SECTION_NAV_SELECTORS) as DevOpsSection[]
).filter((s) => SECTION_NAV_SELECTORS[s] !== '');

// Minimal fallbacks shown before stored/scraped icons are available
const FALLBACK_ICONS: Record<DevOpsSection, string> = {
  overview: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#0078d4"/><path d="M8 2L14 7.5V14H10V10H6V14H2V7.5L8 2Z" fill="white"/></svg>`,
  boards: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#0078d4"/><rect x="2.5" y="3" width="3" height="10" rx=".5" fill="white"/><rect x="6.5" y="3" width="3" height="6.5" rx=".5" fill="white"/><rect x="10.5" y="3" width="3" height="8" rx=".5" fill="white"/></svg>`,
  repos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#107c10"/><circle cx="5" cy="3.5" r="1.5" fill="white"/><circle cx="11" cy="6" r="1.5" fill="white"/><circle cx="5" cy="12.5" r="1.5" fill="white"/><path d="M5 5v6" stroke="white" stroke-width="1.3" stroke-linecap="round" fill="none"/><path d="M5 5.5c1.5-3.5 6-2.5 6 .5" stroke="white" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>`,
  pipelines: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#0078d4"/><rect x="1.5" y="5.5" width="3.5" height="5" rx="1" fill="white"/><rect x="6.25" y="5.5" width="3.5" height="5" rx="1" fill="white"/><rect x="11" y="5.5" width="3.5" height="5" rx="1" fill="white"/><line x1="5" y1="8" x2="6.25" y2="8" stroke="white" stroke-width="1"/><line x1="9.75" y1="8" x2="11" y2="8" stroke="white" stroke-width="1"/></svg>`,
  testplans: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#ca5010"/><path d="M5.5 2h5v5.5l3 5A1.5 1.5 0 0112.2 15H3.8a1.5 1.5 0 01-1.3-2.5l3-5V2z" fill="white"/><circle cx="8" cy="11.5" r="1.5" fill="#ca5010"/></svg>`,
  artifacts: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#ea4300"/><path d="M8 2L14 5.5v5L8 14 2 10.5v-5L8 2z" fill="white"/><path d="M8 2v12M2 5.5l6 3M14 5.5l-6 3" stroke="#ea4300" stroke-width="1" fill="none"/></svg>`,
  wiki: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#5c2d91"/><rect x="2" y="2.5" width="6" height="11" rx="1" fill="white"/><rect x="4" y="5" width="2.5" height="1" fill="#5c2d91"/><rect x="4" y="7" width="2.5" height="1" fill="#5c2d91"/><rect x="4" y="9" width="1.5" height="1" fill="#5c2d91"/><rect x="8.5" y="4" width="5.5" height="9.5" rx="1" fill="white" opacity=".65"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#605e5c"/><circle cx="8" cy="8" r="2.2" fill="none" stroke="white" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="white" stroke-width="1.3" stroke-linecap="round"/></svg>`
};

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

// ── Section detection ────────────────────────────────────────────────────────

function detectSection(href: string): DevOpsSection {
  try {
    const path = new URL(href).pathname.toLowerCase();
    for (const [section, patterns] of Object.entries(SECTION_PATH_PATTERNS) as [
      DevOpsSection,
      string[]
    ][]) {
      if (patterns.some((p) => path.includes(p))) return section;
    }
  } catch {
    /* invalid URL */
  }
  return 'overview';
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

function waitForNav(): Promise<void> {
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
    setTimeout(() => {
      obs.disconnect();
      resolve();
    }, 8000);
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export function initTabIcons(): void {
  startFaviconGuard();
  applyFavicon();

  void (async () => {
    await loadCachedIcons();
    applyFavicon();

    const missing = SCRAPABLE_SECTIONS.filter((s) => !iconCache.has(s));
    if (missing.length > 0) {
      await waitForNav();
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
  window.addEventListener('popstate', () => applyFavicon());

  // Re-apply whenever the tab is switched back to — Azure DevOps may have
  // overwritten the favicon while the tab was in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      applyFavicon();
    }
  });

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
}

export async function rescrapeTabIcons(): Promise<void> {
  iconCache.clear();
  await chrome.storage.local.remove(STORAGE_KEY);
  refreshIconCache();
  applyFavicon();
}
