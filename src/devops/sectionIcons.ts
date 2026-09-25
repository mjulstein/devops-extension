// Which part of Azure DevOps a url belongs to, and the icon that stands for it.
//
// Split out of `tabIcons.ts` because two very different places need the same
// answer: the content script, which paints the tab's favicon, and the service
// worker, which hands icons to the favorites palette. The worker has no DOM, so
// anything touching the page stays behind in `tabIcons.ts` and only this — the
// patterns, the built-in icons and the cache key — lives here.
//
// It matters for the palette because every Azure DevOps page shares one origin
// and therefore one site favicon: a list of favorites drawn from the browser's
// cache is a column of identical logos. The section icon is the one thing that
// actually differs between a board, a repo and a pipeline.

export type DevOpsSection =
  | 'overview'
  | 'boards'
  | 'repos'
  | 'pipelines'
  | 'testplans'
  | 'artifacts'
  | 'wiki'
  | 'settings';

export const TAB_ICON_STORAGE_KEY = 'tabIconCache';

// URL path fragments used by detectSection (always lower-cased before comparison)
export const SECTION_PATH_PATTERNS: Record<DevOpsSection, string[]> = {
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
export const SECTION_NAV_SELECTORS: Record<DevOpsSection, string> = {
  overview: 'a[aria-label="Overview"]',
  boards: 'a[aria-label="Boards"]',
  repos: 'a[aria-label="Repos"]',
  pipelines: 'a[aria-label="Pipelines"]',
  testplans: 'a[aria-label="Test Plans"]',
  artifacts: 'a[aria-label="Artifacts"]',
  wiki: 'a[aria-label="Wiki"]',
  settings: '' // uses an icon font, not scrape-able
};

export const SCRAPABLE_SECTIONS = (
  Object.keys(SECTION_NAV_SELECTORS) as DevOpsSection[]
).filter((s) => SECTION_NAV_SELECTORS[s] !== '');

// Minimal fallbacks shown before stored/scraped icons are available
export const FALLBACK_ICONS: Record<DevOpsSection, string> = {
  overview: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#0078d4"/><path d="M8 2L14 7.5V14H10V10H6V14H2V7.5L8 2Z" fill="white"/></svg>`,
  boards: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#0078d4"/><rect x="2.5" y="3" width="3" height="10" rx=".5" fill="white"/><rect x="6.5" y="3" width="3" height="6.5" rx=".5" fill="white"/><rect x="10.5" y="3" width="3" height="8" rx=".5" fill="white"/></svg>`,
  repos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#107c10"/><circle cx="5" cy="3.5" r="1.5" fill="white"/><circle cx="11" cy="6" r="1.5" fill="white"/><circle cx="5" cy="12.5" r="1.5" fill="white"/><path d="M5 5v6" stroke="white" stroke-width="1.3" stroke-linecap="round" fill="none"/><path d="M5 5.5c1.5-3.5 6-2.5 6 .5" stroke="white" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>`,
  pipelines: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#0078d4"/><rect x="1.5" y="5.5" width="3.5" height="5" rx="1" fill="white"/><rect x="6.25" y="5.5" width="3.5" height="5" rx="1" fill="white"/><rect x="11" y="5.5" width="3.5" height="5" rx="1" fill="white"/><line x1="5" y1="8" x2="6.25" y2="8" stroke="white" stroke-width="1"/><line x1="9.75" y1="8" x2="11" y2="8" stroke="white" stroke-width="1"/></svg>`,
  testplans: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#ca5010"/><path d="M5.5 2h5v5.5l3 5A1.5 1.5 0 0112.2 15H3.8a1.5 1.5 0 01-1.3-2.5l3-5V2z" fill="white"/><circle cx="8" cy="11.5" r="1.5" fill="#ca5010"/></svg>`,
  artifacts: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#ea4300"/><path d="M8 2L14 5.5v5L8 14 2 10.5v-5L8 2z" fill="white"/><path d="M8 2v12M2 5.5l6 3M14 5.5l-6 3" stroke="#ea4300" stroke-width="1" fill="none"/></svg>`,
  wiki: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#5c2d91"/><rect x="2" y="2.5" width="6" height="11" rx="1" fill="white"/><rect x="4" y="5" width="2.5" height="1" fill="#5c2d91"/><rect x="4" y="7" width="2.5" height="1" fill="#5c2d91"/><rect x="4" y="9" width="1.5" height="1" fill="#5c2d91"/><rect x="8.5" y="4" width="5.5" height="9.5" rx="1" fill="white" opacity=".65"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#605e5c"/><circle cx="8" cy="8" r="2.2" fill="none" stroke="white" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="white" stroke-width="1.3" stroke-linecap="round"/></svg>`
};

export function detectSection(href: string): DevOpsSection {
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

/** The built-in icon for a section, as a data URI. Always available. */
export function fallbackSectionIcon(section: DevOpsSection): string {
  return `data:image/svg+xml,${encodeURIComponent(FALLBACK_ICONS[section])}`;
}

/** The section of an Azure DevOps url; null for anywhere else. */
export function adoSectionOf(url: string): DevOpsSection | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host !== 'dev.azure.com' && !host.endsWith('.visualstudio.com')) {
    return null;
  }
  return detectSection(url);
}

/**
 * The icon for an Azure DevOps url: the scraped one when the cache holds it,
 * the built-in one otherwise. Null for anything that is not Azure DevOps, so
 * callers fall back to that site's own favicon.
 */
export function sectionIconForUrl(
  url: string,
  cache: Record<string, string>
): string | null {
  const section = adoSectionOf(url);
  return section === null
    ? null
    : (cache[section] ?? fallbackSectionIcon(section));
}
