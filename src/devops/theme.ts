// Azure DevOps's own light/dark setting.
//
// The panel does not keep a theme preference of its own: it reads and writes the
// one the user already has in Azure DevOps, so the two cannot drift apart. The
// setting lives in the per-user settings entries collection, which is the same
// store Azure DevOps's own theme picker writes.
//
// The entry key and its values are Azure DevOps's, not ours, and are not part of
// a documented contract — if they change, reading returns null and the switch
// reports that it could not read the theme rather than guessing.

import { authFetch } from './authFetch';
import { readPatRecord } from './auth/patStore';

export type AdoTheme = 'light' | 'dark';

/** Raised when the token cannot reach the settings API, which is not a failure to retry. */
export class ThemeScopeUnavailableError extends Error {
  constructor() {
    super(
      'Azure DevOps did not grant this extension the settings scope, so its theme cannot be read or changed here.'
    );
    this.name = 'ThemeScopeUnavailableError';
  }
}

/** Whether a PAT's scope reaches the settings API the theme lives in. */
export function scopeCoversTheme(scope: string | undefined): boolean {
  return scope?.includes('vso.settings') ?? false;
}

/**
 * Refuses the call when the token could not reach the settings API anyway.
 *
 * Without this, each attempt would meet a 401, force a rotation, and mint a
 * fresh token that is refused in exactly the same way — a new credential per
 * keystroke on the theme switch, and never a working one.
 */
async function assertThemeScope(): Promise<void> {
  const record = await readPatRecord();
  if (record && !scopeCoversTheme(record.scope)) {
    throw new ThemeScopeUnavailableError();
  }
}

const SETTINGS_ENTRIES_URL = (organization: string) =>
  `https://dev.azure.com/${encodeURIComponent(organization)}/_apis/settings/entries/me?api-version=3.2-preview.1`;

const THEME_ENTRY_KEY = 'WebPlatform/Theme';
const DARK_THEME_ID = 'ms.vss-web.vsts-theme-dark';
const LIGHT_THEME_ID = 'ms.vss-web.vsts-theme';

/**
 * Reads a theme out of a settings-entries response.
 *
 * Anything unrecognised is null rather than a guess: reporting "could not read
 * the theme" is honest, while defaulting to light would silently flip the panel
 * away from a dark page.
 */
export function parseAdoThemeSetting(value: unknown): AdoTheme | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (value === DARK_THEME_ID) {
    return 'dark';
  }
  if (value === LIGHT_THEME_ID) {
    return 'light';
  }
  // Azure DevOps has shipped more than one dark theme id over time, so match on
  // the distinguishing part rather than on an exact list that will go stale.
  return value.includes('dark') ? 'dark' : 'light';
}

/** The entry body that sets a theme. */
export function buildAdoThemeSetting(theme: AdoTheme): Record<string, string> {
  return {
    [THEME_ENTRY_KEY]: theme === 'dark' ? DARK_THEME_ID : LIGHT_THEME_ID
  };
}

export async function fetchAdoTheme(
  organization: string
): Promise<AdoTheme | null> {
  await assertThemeScope();
  const response = await authFetch(SETTINGS_ENTRIES_URL(organization));
  if (!response.ok) {
    throw new Error(
      `Could not read the Azure DevOps theme (HTTP ${response.status}).`
    );
  }
  const body = (await response.json()) as { value?: Record<string, unknown> };
  return parseAdoThemeSetting(body.value?.[THEME_ENTRY_KEY]);
}

export async function setAdoTheme(
  organization: string,
  theme: AdoTheme
): Promise<void> {
  await assertThemeScope();
  const response = await authFetch(SETTINGS_ENTRIES_URL(organization), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildAdoThemeSetting(theme))
  });
  if (!response.ok) {
    throw new Error(
      `Could not change the Azure DevOps theme (HTTP ${response.status}).`
    );
  }
}
