import { sectionIconForUrl } from '@/devops/sectionIcons';

/**
 * Icons for favorites, read from the browser's own favicon cache.
 *
 * The browser already holds an icon for every bookmarked page — it is what the
 * bookmarks menu draws — so nothing needs to be captured when a page is starred
 * and nothing extra is stored. That also means a favorite adopted from a
 * bookmark synced in from another machine gets an icon on the same terms as one
 * starred here.
 *
 * The cache is reached through the `_favicon/` endpoint the `favicon` permission
 * unlocks. Outside the extension (the dev harness) there is no such endpoint, so
 * this returns null and callers leave the space empty rather than requesting an
 * icon over the network.
 */

/**
 * The icon to draw beside a favorite.
 *
 * Azure DevOps is asked about first, because all of it shares one origin and so
 * one site favicon: keyed by the browser's cache alone, a list of Azure DevOps
 * favorites is a column of identical logos. The section icon is the only thing
 * in the picture that differs between a board, a repo and a pipeline.
 */
export function getFavoriteIconUrl(
  pageUrl: string,
  sectionIcons: Record<string, string> = {},
  size = 16
): string | null {
  const section = sectionIconForUrl(pageUrl, sectionIcons);
  if (section !== null) {
    return section;
  }
  return getCachedFaviconUrl(pageUrl, size);
}

/** The browser's own cached icon for a page, through the `favicon` permission. */
export function getCachedFaviconUrl(pageUrl: string, size = 16): string | null {
  const getExtensionUrl = globalThis.chrome?.runtime?.getURL;
  if (typeof getExtensionUrl !== 'function') {
    return null;
  }

  const url = new URL(getExtensionUrl('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}
