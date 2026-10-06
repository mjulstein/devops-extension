// Switching environment without losing your place.
//
// Picking another environment of the app you are already looking at is almost
// never a request for its front page: you are on a record, a report, a search,
// and you want the same thing in the other environment. So only the host
// changes, and the path, query and fragment come with you.
//
// It only applies between two environments of the *same* app. That is checked
// against the app's own stored addresses rather than guessed from the names,
// because the addresses are the only thing that is reliably true — deployments
// are inconsistent enough that `myapp-dev` and `my-app-test` belong to one app.

import { hostOf, type AppEntry, type AppEnvironment } from './appDns';

/**
 * Which of the app's environments an address is in, by its host.
 *
 * The bookmarks are the authority, not the address: each one is named for its
 * environment and holds that environment's own address, so matching the host
 * against them says which environment you are standing in without reading
 * anything out of the DNS. That is what makes an inconsistent deployment work —
 * `myapp-dev` and `my-app-test` are both recognised because both are bookmarked,
 * where any rule based on the names would miss one of them.
 *
 * Only the host is compared, so a bookmark that still carries a path or a query
 * is matched the same as one that has been cleaned down to its origin.
 */
export function identifyEnvironment(
  app: AppEntry,
  url: string | null
): AppEnvironment | null {
  const host = url === null ? null : hostOf(url);
  if (host === null) {
    return null;
  }
  return (
    app.environments.find((environment) => hostOf(environment.url) === host) ??
    null
  );
}

/**
 * The address to open: the chosen environment, carrying where you already are.
 *
 * Returns the target untouched unless the page you are on is a *different*
 * environment of the same app. Standing on the app's front page there is
 * nothing to carry, and standing somewhere else entirely it would be wrong to.
 */
export function carryPathAcrossEnvironments(
  app: AppEntry,
  targetUrl: string,
  currentUrl: string | null
): string {
  if (currentUrl === null) {
    return targetUrl;
  }

  const targetHost = hostOf(targetUrl);
  const currentHost = hostOf(currentUrl);
  if (
    targetHost === null ||
    currentHost === null ||
    targetHost === currentHost ||
    identifyEnvironment(app, currentUrl) === null
  ) {
    return targetUrl;
  }

  let target: URL;
  let current: URL;
  try {
    target = new URL(targetUrl);
    current = new URL(currentUrl);
  } catch {
    return targetUrl;
  }

  // Nothing worth carrying: the front page of one environment is the front page
  // of the next, and carrying "/" would only overwrite a path the environment's
  // own bookmark deliberately has.
  if (
    current.pathname === '/' &&
    current.search === '' &&
    current.hash === ''
  ) {
    return targetUrl;
  }

  // The target contributes its origin and nothing else. A bookmark that has not
  // been cleaned down to its base still switches correctly, because where you
  // are going is where you already are.
  target.pathname = current.pathname;
  target.search = current.search;
  target.hash = current.hash;
  return target.toString();
}

/**
 * Whether two addresses are the same page for the purpose of reusing a tab.
 *
 * The query counts — a report with different parameters is a different report —
 * and the fragment does not, since a tab already open at the page can be sent to
 * the fragment without being reloaded.
 */
export function isSamePage(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return (
      left.origin === right.origin &&
      left.pathname.replace(/\/+$/, '') ===
        right.pathname.replace(/\/+$/, '') &&
      left.search === right.search
    );
  } catch {
    return a === b;
  }
}
