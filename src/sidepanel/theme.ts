// Applying a theme to the side panel document.
//
// The values themselves live in `src/theme.css`; this only decides which set is
// in force. The last known theme is remembered browser-locally so the panel
// opens in the right one instead of flashing light before Azure DevOps answers —
// it is a cache of Azure DevOps's setting, never a preference of its own.

import type { AdoTheme } from '@/devops/theme';

export const THEME_STORAGE_KEY = 'lastKnownAdoTheme';

/** Light unless a dark theme is in force, which is what the stylesheet expects. */
export function applyTheme(theme: AdoTheme): void {
  document.documentElement.dataset.theme = theme;
}

export function isAdoTheme(value: unknown): value is AdoTheme {
  return value === 'light' || value === 'dark';
}

export async function loadLastKnownTheme(): Promise<AdoTheme> {
  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  const value = stored[THEME_STORAGE_KEY];
  return isAdoTheme(value) ? value : 'light';
}

export async function saveLastKnownTheme(theme: AdoTheme): Promise<void> {
  await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
}
