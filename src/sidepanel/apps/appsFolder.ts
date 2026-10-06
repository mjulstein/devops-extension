// Where apps live: real bookmarks, in a folder of their own.
//
//   <favorites folder>/
//     Apps/
//       my-app/
//         live   -> https://my-app.orgname.com
//         test   -> https://my-app-test.orgname.com
//       other-app/
//         ...
//
// A folder per app, a bookmark per environment, titled with the environment's
// name. Bookmarks rather than stored settings for the same reason the favorites
// and the quick tasks are bookmarks: the browser syncs them, so the apps reach a
// machine that has never had this extension installed, and they can be
// rearranged with the bookmark manager like anything else. The order inside an
// app's folder is the order the environments are offered in, so rearranging
// them there is how you say which one Enter should take.
//
// It sits under `Apps` rather than beside the favorites so it does not mix with
// them: a favorite is one page, an app is a family of addresses for the same
// thing, and a search that put twelve environments among the favorites would
// bury them.

import {
  findOrCreateChildFolder,
  findOrCreateFolderByName
} from '../bookmarkSync';
import type { AppEntry } from './appDns';

/** Sub-folder of the configured favorites folder that holds the apps. */
export const APPS_BOOKMARK_FOLDER = 'Apps';

export interface AppsTreeNode {
  id: string;
  title?: string;
  url?: string;
  children?: AppsTreeNode[];
}

/**
 * The apps held in an `Apps` folder node.
 *
 * Order is the folder's own, untouched, at both levels. An app folder with
 * nothing in it is still an app: it is what a folder looks like between being
 * created and having its first environment added.
 */
export function readAppsFromFolder(node: AppsTreeNode | null): AppEntry[] {
  if (!node?.children) {
    return [];
  }

  return node.children
    .filter((child) => child.url === undefined && (child.title ?? '') !== '')
    .map((child) => ({
      name: child.title ?? '',
      environments: (child.children ?? [])
        .filter(
          (leaf): leaf is AppsTreeNode & { url: string } =>
            typeof leaf.url === 'string' && (leaf.title ?? '') !== ''
        )
        .map((leaf) => ({ name: leaf.title ?? '', url: leaf.url }))
    }));
}

/** Finds the `Apps` folder inside a tree, by walking to it from the root. */
export function findAppsFolder(
  tree: AppsTreeNode[],
  favoritesFolderName: string
): AppsTreeNode | null {
  const favorites = findFolder(tree, favoritesFolderName);
  return favorites === null
    ? null
    : findFolder([favorites], APPS_BOOKMARK_FOLDER);
}

function findFolder(nodes: AppsTreeNode[], title: string): AppsTreeNode | null {
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (node.url === undefined && node.title === title) {
      return node;
    }
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return null;
}

/** Reads the apps out of the browser, or an empty list if there are none. */
export async function loadApps(
  favoritesFolderName: string
): Promise<AppEntry[]> {
  if (!favoritesFolderName.trim()) {
    return [];
  }
  try {
    const tree = (await chrome.bookmarks.getTree()) as AppsTreeNode[];
    return readAppsFromFolder(findAppsFolder(tree, favoritesFolderName));
  } catch {
    // No apps is a usable answer; a thrown one is not.
    return [];
  }
}

/** The app's folder, making it and everything above it if need be. */
async function appFolderId(
  favoritesFolderName: string,
  appName: string
): Promise<{ id: string } | { error: string }> {
  if (!favoritesFolderName.trim()) {
    return { error: 'Name a favorites folder in Settings first.' };
  }
  if (!appName.trim()) {
    return { error: 'That address does not say what the app is called.' };
  }

  const favorites = await findOrCreateFolderByName(favoritesFolderName);
  if ('error' in favorites) {
    return favorites;
  }

  const appsFolder = await findOrCreateChildFolder(
    favorites.id,
    APPS_BOOKMARK_FOLDER
  );
  if ('error' in appsFolder) {
    return appsFolder;
  }

  return await findOrCreateChildFolder(appsFolder.id, appName.trim());
}

/**
 * Adds an environment to an app, creating the folders on the way.
 *
 * An environment already stored under that name is updated rather than
 * duplicated: adding the same environment twice is how an address gets
 * corrected after the suggested one turned out to be wrong.
 */
export async function addAppEnvironment(
  favoritesFolderName: string,
  appName: string,
  envName: string,
  url: string
): Promise<{ ok: true } | { error: string }> {
  const appFolder = await appFolderId(favoritesFolderName, appName);
  if ('error' in appFolder) {
    return { error: appFolder.error };
  }

  try {
    const children = await chrome.bookmarks.getChildren(appFolder.id);
    const existing = children.find(
      (node) =>
        node.url !== undefined &&
        (node.title ?? '').trim().toLowerCase() === envName.trim().toLowerCase()
    );
    if (existing) {
      await chrome.bookmarks.update(existing.id, {
        title: envName.trim(),
        url
      });
    } else {
      await chrome.bookmarks.create({
        parentId: appFolder.id,
        title: envName.trim(),
        url
      });
    }
    return { ok: true };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : String(cause)
    };
  }
}
