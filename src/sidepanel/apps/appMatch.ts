// Deciding which app a page belongs to.
//
// Reading the app out of the DNS works for a first registration, but once an
// app has a folder its *name* is the better answer: it is the name you chose,
// and the address only has to contain it. That is what makes adding an
// environment one keystroke instead of a spelling exercise — you are on the
// page, the folder already exists, and the address says which one it is.
//
// Matching ignores punctuation, because deployments do not keep it straight:
// `myapp-dev.orgname.com` belongs to the app you called `my-app`, and refusing
// it over a hyphen would be technically correct and useless.

import { hostOf, parseAppUrl, type AppEntry } from './appDns';

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The app whose name appears in this address, or null.
 *
 * The longest name wins, so an app called `my-app-admin` is not swallowed by
 * one called `my-app` when the address contains both.
 */
export function findAppForUrl(apps: AppEntry[], url: string): AppEntry | null {
  const host = hostOf(url);
  if (host === null) {
    return null;
  }
  const needle = squash(host);

  return (
    [...apps]
      .filter((app) => {
        const name = squash(app.name);
        return name !== '' && needle.includes(name);
      })
      .sort((a, b) => squash(b.name).length - squash(a.name).length)[0] ?? null
  );
}

/**
 * A name for the bookmark being added.
 *
 * The environment the address names, when it names one. Otherwise the host
 * itself — not a guess at what the environment is called, because there is no
 * list of environment names here and inventing one would be worse than a name
 * you can see is a placeholder. It is one rename away in the bookmark manager,
 * and nothing depends on it: the address is what matters.
 */
export function suggestEnvName(url: string): string {
  const parsed = parseAppUrl(url);
  if (parsed === null) {
    return url;
  }
  return parsed.envName ?? hostOf(url) ?? url;
}
