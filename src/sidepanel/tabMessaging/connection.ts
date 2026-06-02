import type { RuntimeResponse } from './runtimeResponse';

export type ConnectionStatus = 'connected' | 'reconnect-needed';

// Lazy ensure-valid: called when the side panel opens (spec FR-005). The service
// worker mints/rotates if needed and returns the derived connection status.
export async function ensureConnection(
  organization: string
): Promise<ConnectionStatus> {
  const response: RuntimeResponse<ConnectionStatus> =
    await chrome.runtime.sendMessage({
      type: 'ENSURE_CONNECTION',
      payload: { organization }
    });

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Connection check failed.');
  }
  return response.result;
}

// Manual Retry control shown after an automatic recovery fails (spec FR-008).
export async function retryConnection(
  organization: string
): Promise<ConnectionStatus> {
  const response: RuntimeResponse<ConnectionStatus> =
    await chrome.runtime.sendMessage({
      type: 'RETRY_CONNECTION',
      payload: { organization }
    });

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Reconnect attempt failed.');
  }
  return response.result;
}
