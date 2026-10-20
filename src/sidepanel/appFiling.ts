// Where a newly made bookmark belongs.
//
// An app folder already says which addresses are that app's, so a bookmark on
// one of those addresses has an obvious home and asking for it again — or
// leaving it in whatever folder the browser last used — is work the definition
// has already done. Saving a page on a host an app covers files it under that
// app, and under the sub-group that covers it when one does.
//
// It answers with a folder or with nothing. Nothing is the common case: most
// bookmarks are not on an app's host, and a bookmark that was not asked about
// should be left exactly where the browser put it.

import { type AppFolder } from './appGroups';
import { urlMatchesPattern } from './tabGroupPattern';

/**
 * The folder a bookmark on this address belongs in, or null for none.
 *
 * The longest matching name wins at both levels, the same rule the tab groups
 * use: a sub-group exists to separate part of an app out, and a folder named
 * for a sub-domain exists to separate it from the domain above it.
 */
export function appFolderFor(
  folders: AppFolder[],
  url: string
): { id: string; name: string } | null {
  let app: AppFolder | null = null;
  for (const folder of folders) {
    const pattern = folder.name.trim();
    if (!urlMatchesPattern(url, pattern)) {
      continue;
    }
    if (app === null || pattern.length > app.name.trim().length) {
      app = folder;
    }
  }
  if (app === null) {
    return null;
  }

  let best: { id: string; name: string } = { id: app.id, name: app.name };
  let bestLength = -1;
  for (const sub of app.subGroups) {
    const pattern = sub.name.trim();
    if (urlMatchesPattern(url, pattern) && pattern.length > bestLength) {
      best = { id: sub.id, name: sub.name };
      bestLength = pattern.length;
    }
  }
  return best;
}
