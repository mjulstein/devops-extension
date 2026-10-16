// A tab group is an app folder, and its scope is what its bookmarks share.
//
// The groups used to be patterns typed into Settings, which meant they lived on
// one machine and said nothing to another. Bookmarks are the half the browser
// syncs, so the definitions move there: a folder under `Apps` is a group, the
// bookmarks in it are its addresses, and a folder inside it is a sub-group.
//
// Nothing is typed twice. A folder's scope is read back out of what is in it —
// the domain they all share, then the path or sub-domain they all share — which
// is also the rule for what may be added: a bookmark that does not share the
// domain belongs to a different group, and saying so is the whole point of
// having one.

export interface AppBookmark {
  id: string;
  name: string;
  url: string;
}

export interface AppFolderScope {
  /** The domain every address in the folder sits under. */
  domain: string;
  /** The exact host when they all share one; empty when they differ. */
  host: string;
  /** The path every address starts with, by segment. */
  path: string;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * The domain a set of hosts have in common, by label.
 *
 * `test.my-app.com` and `my-app.com` share `my-app.com`; `a.test` and `b.test`
 * share `test`. Compared from the right, because that is the end a domain is
 * read from and the end that means anything.
 */
export function commonDomain(hosts: string[]): string {
  const live = hosts.filter((host) => host !== '');
  if (live.length === 0) {
    return '';
  }

  const parts = live.map((host) => host.split('.').reverse());
  const shared: string[] = [];

  for (let index = 0; index < parts[0].length; index += 1) {
    const label = parts[0][index];
    if (!parts.every((entry) => entry[index] === label)) {
      break;
    }
    shared.push(label);
  }

  return shared.reverse().join('.');
}

/**
 * The path a set of addresses have in common, by segment.
 *
 * By segment rather than by character, so `/spaces` and `/spacesuit` are not
 * told they share `/spaces` — they share nothing, and a scope built from a
 * half-segment would sweep in pages that have no business in the group.
 */
export function commonPathPrefix(paths: string[]): string {
  if (paths.length === 0) {
    return '';
  }

  const parts = paths.map((path) => path.split('/').filter(Boolean));
  const shared: string[] = [];

  for (let index = 0; index < parts[0].length; index += 1) {
    const segment = parts[0][index];
    if (!parts.every((entry) => entry[index] === segment)) {
      break;
    }
    shared.push(segment);
  }

  return shared.length === 0 ? '' : `/${shared.join('/')}`;
}

/**
 * What a folder covers, read back out of what is in it.
 *
 * An empty folder covers nothing: it has said nothing about itself yet, and a
 * scope guessed from its name would be a guess the user never made.
 */
export function deriveFolderScope(bookmarks: AppBookmark[]): AppFolderScope {
  const urls = bookmarks.map((bookmark) => bookmark.url);
  const hosts = urls
    .map(hostOf)
    .filter((host): host is string => host !== null);

  if (hosts.length === 0) {
    return { domain: '', host: '', path: '' };
  }

  return {
    domain: commonDomain(hosts),
    host: hosts.every((host) => host === hosts[0]) ? hosts[0] : '',
    path: commonPathPrefix(urls.map(pathOf))
  };
}

/** Whether an address falls inside a folder's scope. */
export function scopeMatches(url: string, scope: AppFolderScope): boolean {
  if (scope.domain === '') {
    return false;
  }
  const host = hostOf(url);
  if (host === null) {
    return false;
  }
  if (host !== scope.domain && !host.endsWith(`.${scope.domain}`)) {
    return false;
  }
  if (scope.path === '') {
    return true;
  }
  const path = pathOf(url);
  return path === scope.path || path.startsWith(`${scope.path}/`);
}

/**
 * Why this address does not belong in this folder, or null when it does.
 *
 * The panel asks before adding, because the scope is derived: letting in an
 * address that shares nothing would silently widen the group to the point where
 * it stops meaning anything, and the user would see a group quietly swallow
 * their whole browser.
 */
export function describeScopeViolation(
  url: string,
  scope: AppFolderScope
): string | null {
  if (scope.domain === '') {
    return null;
  }
  const host = hostOf(url);
  if (host === null) {
    return 'That is not an address this can group.';
  }
  if (host !== scope.domain && !host.endsWith(`.${scope.domain}`)) {
    return `This group is ${scope.domain}; ${host} belongs somewhere else.`;
  }
  if (scope.path !== '' && !scopeMatches(url, scope)) {
    return `This group is ${scope.domain}${scope.path}; that address is outside it.`;
  }
  return null;
}
