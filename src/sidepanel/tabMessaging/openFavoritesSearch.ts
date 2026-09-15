import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

/**
 * Asks the service worker to open the favorites search on whichever surface
 * suits the active tab: the palette over an Azure DevOps page, or the panel's
 * own menu. Routed through the worker so the panel's trigger and the keyboard
 * shortcut cannot disagree about where it opens.
 */
export async function openFavoritesSearch(): Promise<
  RuntimeResponse<'overlay' | 'panel'>
> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({ type: 'OPEN_FAVORITES_SEARCH' }),
    'OPEN_FAVORITES_SEARCH'
  );
}
