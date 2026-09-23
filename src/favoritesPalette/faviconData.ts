// Favicons for the palette, fetched by the service worker.
//
// The side panel can point an <img> straight at the browser's favicon cache,
// because an extension page may read its own extension URLs. The palette cannot:
// it renders inside Azure DevOps's page, and an extension resource is not
// loadable from there. So the worker reads the icons and passes them along as
// data URIs.
//
// Keyed by origin rather than by page. Every board, query and work item on an
// Azure DevOps organization shares one icon, so per-page fetching would do the
// same work dozens of times for the same picture.

/** Origins to fetch at most, so a wide search cannot turn into a stampede. */
const MAX_ORIGINS = 24;

export type FaviconMap = Record<string, string>;

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The distinct origins in a list of urls, in first-seen order and capped. */
export function collectOrigins(urls: string[], limit = MAX_ORIGINS): string[] {
  const origins: string[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const origin = originOf(url);
    if (origin === null || seen.has(origin)) {
      continue;
    }
    seen.add(origin);
    origins.push(origin);
    if (origins.length >= limit) {
      break;
    }
  }

  return origins;
}

/** The extension URL that serves the browser's cached icon for a page. */
export function buildFaviconRequestUrl(
  origin: string,
  size = 16
): string | null {
  const getExtensionUrl = globalThis.chrome?.runtime?.getURL;
  if (typeof getExtensionUrl !== 'function') {
    return null;
  }
  const url = new URL(getExtensionUrl('/_favicon/'));
  url.searchParams.set('pageUrl', origin);
  url.searchParams.set('size', String(size));
  return url.toString();
}

export interface FaviconDeps {
  fetchFn: typeof fetch;
  toDataUrl: (blob: Blob) => Promise<string>;
}

/**
 * Icons for these urls, one per origin, as data URIs.
 *
 * A cache is passed in and mutated so repeated searches in one session reuse
 * what was already fetched. An origin whose icon cannot be read is remembered as
 * a miss too — retrying it on every keystroke would be the same failure at a
 * cost.
 */
export async function loadFaviconsForUrls(
  urls: string[],
  cache: Map<string, string>,
  deps: FaviconDeps
): Promise<FaviconMap> {
  const icons: FaviconMap = {};

  for (const origin of collectOrigins(urls)) {
    if (!cache.has(origin)) {
      cache.set(origin, await readFavicon(origin, deps));
    }
    const cached = cache.get(origin);
    if (cached) {
      icons[origin] = cached;
    }
  }

  return icons;
}

async function readFavicon(origin: string, deps: FaviconDeps): Promise<string> {
  const requestUrl = buildFaviconRequestUrl(origin);
  if (requestUrl === null) {
    return '';
  }
  try {
    const response = await deps.fetchFn(requestUrl);
    if (!response.ok) {
      return '';
    }
    return await deps.toDataUrl(await response.blob());
  } catch {
    // No icon is a blank space, which is what the palette shows anyway.
    return '';
  }
}

/** Default reader, in the worker where FileReader exists. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}
