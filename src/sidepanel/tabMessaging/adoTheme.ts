import type { Settings } from '@/types';
import type { AdoTheme } from '@/devops/theme';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

// The panel shows and changes Azure DevOps's own theme rather than keeping one
// of its own, so both of these go through the service worker, which is where the
// authenticated calls live.

export async function getAdoTheme(
  settings: Settings
): Promise<RuntimeResponse<AdoTheme | null>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'GET_ADO_THEME',
      payload: { settings }
    }),
    'GET_ADO_THEME'
  );
}

export async function setAdoTheme(
  settings: Settings,
  theme: AdoTheme
): Promise<RuntimeResponse<AdoTheme>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'SET_ADO_THEME',
      payload: { settings, theme }
    }),
    'SET_ADO_THEME'
  );
}
