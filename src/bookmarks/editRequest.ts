/**
 * A request, from elsewhere in the extension, to open one bookmark for editing
 * in the bookmark manager.
 *
 * It travels through session storage rather than the page's address because
 * the manager is a single window: when it is already open it is raised, not
 * reloaded, so a query string would never be read again. Storage reaches a page
 * that is already running through its change event, and one that is about to
 * load through a read on mount, which is the same request either way.
 *
 * Session storage, because a request to edit something is about this moment;
 * one surviving a browser restart would open an editor nobody asked for.
 */

export const BOOKMARK_EDIT_REQUEST_KEY = 'bookmarkEditRequest';

export interface BookmarkEditRequest {
  bookmarkId: string;
  /** Distinguishes a second request for the same bookmark from the first. */
  at: number;
}

export function isBookmarkEditRequest(
  value: unknown
): value is BookmarkEditRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.bookmarkId === 'string' &&
    candidate.bookmarkId !== '' &&
    typeof candidate.at === 'number'
  );
}

export async function requestBookmarkEdit(bookmarkId: string): Promise<void> {
  const request: BookmarkEditRequest = { bookmarkId, at: Date.now() };
  await chrome.storage.session.set({ [BOOKMARK_EDIT_REQUEST_KEY]: request });
}

/** Takes the pending request, if any, so it is acted on once. */
export async function takeBookmarkEditRequest(): Promise<BookmarkEditRequest | null> {
  const stored = await chrome.storage.session.get(BOOKMARK_EDIT_REQUEST_KEY);
  const request = stored[BOOKMARK_EDIT_REQUEST_KEY];
  if (!isBookmarkEditRequest(request)) {
    return null;
  }
  await chrome.storage.session.remove(BOOKMARK_EDIT_REQUEST_KEY);
  return request;
}

/** Calls back on each new request while the page is open. */
export function subscribeToBookmarkEditRequests(
  onRequest: () => void
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ): void => {
    if (
      area === 'session' &&
      isBookmarkEditRequest(changes[BOOKMARK_EDIT_REQUEST_KEY]?.newValue)
    ) {
      onRequest();
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
