// A tab group is an app folder, and the folder's name is the rule.
//
// The groups used to be patterns typed into Settings, which meant they lived on
// one machine and said nothing to another. Bookmarks are the half the browser
// syncs, so the definition moves there — and it moves into the folder's name,
// because the name is the part that survives the trip:
//
//   Apps/
//     example.com/     the app: everything on that domain
//       Home           the few addresses worth having without the extension
//       Report
//
// One level, and flat. A folder is a domain and the bookmarks inside it are
// addresses, with no folders between them: how the open pages of a domain are
// then arranged is the side panel's business, not something to be written into
// somebody's bookmarks and synced to every machine they own.
//
// The bookmarks are the few main addresses rather than a list of everywhere you
// have been. Whatever else you open on that domain is grouped with them anyway,
// because the rule is the folder's name and not its contents.

export interface AppBookmark {
  id: string;
  name: string;
  url: string;
}

export interface AppFolder {
  id: string;
  /** The folder's name, which is the rule: a domain. */
  name: string;
  bookmarks: AppBookmark[];
}

export interface AppFolderNode {
  id: string;
  title?: string;
  url?: string;
  children?: AppFolderNode[];
}

/**
 * The `Apps` folder read as a list of groups.
 *
 * Folders one deep, and only the bookmarks directly inside each. Anything
 * nested further is somebody organising their own bookmarks, which is theirs
 * to do and not a grouping this has an opinion about.
 */
export function readAppFolders(node: AppFolderNode | null): AppFolder[] {
  if (!node?.children) {
    return [];
  }

  return node.children
    .filter((child) => child.url === undefined && (child.title ?? '') !== '')
    .map((child) => ({
      id: child.id,
      name: child.title ?? '',
      bookmarks: (child.children ?? [])
        .filter(
          (leaf): leaf is AppFolderNode & { url: string } =>
            typeof leaf.url === 'string'
        )
        .map((leaf) => ({
          id: leaf.id,
          name: (leaf.title ?? '').trim() || leaf.url,
          url: leaf.url
        }))
    }));
}

/**
 * Whether two addresses are the same place, ignoring the query.
 *
 * A bookmark names a place; a query names a view of it. Two tabs on the same
 * path with different parameters are variants of one thing, and a bookmark that
 * only matched an exact query would sit there offering to open a page already
 * open in front of you.
 *
 * The fragment is ignored for the same reason, and because a tab already at the
 * page can be sent to a fragment without being reloaded.
 */
export function sameBase(a: string, b: string): boolean {
  const base = (raw: string): string | null => {
    try {
      const url = new URL(raw);
      const path = url.pathname.replace(/\/+$/, '');
      return `${url.origin.toLowerCase()}${path.toLowerCase()}`;
    } catch {
      return null;
    }
  };

  const left = base(a);
  const right = base(b);
  return left !== null && left === right;
}

/**
 * The bookmarks with nothing open at their address.
 *
 * The ones with a tab already there are left out: the tab is the thing to act
 * on, and a row offering to open what is open in front of you is a row that
 * does nothing. They still did their job — the bookmark is what put that tab in
 * this group.
 */
export function unopenedBookmarks(
  bookmarks: AppBookmark[],
  openUrls: string[]
): AppBookmark[] {
  return bookmarks.filter(
    (bookmark) => !openUrls.some((url) => sameBase(url, bookmark.url))
  );
}
