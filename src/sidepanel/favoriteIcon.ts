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
export function getFavoriteIconUrl(pageUrl: string, size = 16): string | null {
  const getExtensionUrl = globalThis.chrome?.runtime?.getURL;
  if (typeof getExtensionUrl !== 'function') {
    return null;
  }

  const url = new URL(getExtensionUrl('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}
