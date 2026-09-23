export type RuntimeResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

/**
 * Normalises what `chrome.runtime.sendMessage` actually resolves to.
 *
 * It resolves to `undefined` when no listener handled the message — which in
 * practice means the background script is running an older build than the panel
 * (the usual cause: the extension was rebuilt but not reloaded, since reloading
 * the panel alone does not restart the service worker). Left unchecked the panel
 * then fails with "Cannot read properties of undefined (reading 'ok')", which
 * says nothing about the cause.
 */
export function expectRuntimeResponse<T>(
  response: RuntimeResponse<T> | undefined | null,
  messageType: string
): RuntimeResponse<T> {
  if (response) {
    return response;
  }
  return {
    ok: false,
    error:
      `The background script did not answer "${messageType}". ` +
      'Reload the extension on chrome://extensions — it is probably running an older build than the side panel.'
  };
}
