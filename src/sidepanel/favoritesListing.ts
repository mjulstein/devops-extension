// The favorites list as it is shown, in sections.
//
// Normally two: the favorites you chose, then the quick tasks that happen to be
// open. They are kept apart because they are different kinds of thing — a
// favorite is a place you picked and expect to stay put, a quick task is work
// that will vanish when it is done — and mixing them would let today's work push
// a board you rely on down the list.
//
// A widened search (see favoritesQuery) replaces both with the browser's own
// bookmarks. With nothing typed it offers the folders instead of every bookmark
// you own, because the folders are how you already organise them and picking one
// is how you reach a list worth reading. Once something is typed, a folder whose
// name matches brings its whole contents along.

import { rankFavorites, type StarredPage } from './starredPages';
import { parseFavoritesQuery } from './favoritesQuery';
import type { BookmarkFolder } from './bookmarkFolders';
import type { AppEntry } from './apps/appDns';
import { matchApps, parseAppQuery, resolveAppTarget } from './apps/appsQuery';
import { envToken, type AppEnvironment } from './apps/appDns';
import { orderEnvironmentsForSwitching, type EnvUsage } from './apps/envSwitch';
import {
  matchCommands,
  QUICK_COMMANDS,
  type QuickCommand
} from './commands/quickCommands';

/** A row is somewhere to go, a folder to look inside, or an app to aim. */
export type FavoritesRow =
  | { kind: 'page'; page: StarredPage }
  | { kind: 'folder'; folder: BookmarkFolder }
  | { kind: 'command'; command: QuickCommand; text: string }
  /** An app to walk into, in the `-` listing. */
  | { kind: 'app-folder'; app: AppEntry }
  /**
   * One environment of an app. It carries the app rather than being a plain
   * page row, because opening it is a switch *within* that app: the page you
   * are standing on comes with you, and only the app's own addresses can say
   * whether you are standing on a sibling environment.
   */
  | { kind: 'app-env'; app: AppEntry; environment: AppEnvironment }
  | {
      kind: 'app';
      app: AppEntry;
      /**
       * The environment term typed alongside the app name, if any. The row
       * resolves it to an address at render time rather than here, because
       * which environment a row points at also depends on how many times Tab
       * has been pressed on it — and that belongs to the view, not the list.
       */
      envTerm: string | null;
    };

export interface FavoritesSection {
  /** Shown on the divider above the section; null for the leading one. */
  label: string | null;
  /** Whether the rows sit in from the edge, which is how folders read. */
  indent: boolean;
  /** Where this section's first row sits in `rows`. */
  startIndex: number;
  rows: FavoritesRow[];
}

export interface FavoritesListing {
  sections: FavoritesSection[];
  /** Every row in display order, which is what the keyboard walks. */
  rows: FavoritesRow[];
}

/** A bookmark plus the folder holding it, which is what the grouping needs. */
export interface FoldedBookmark {
  page: StarredPage;
  folder: string;
  /**
   * True when this came along because its *folder* matched, not its own title.
   * Those are exempt from the term filter: asking for a folder by name and then
   * being shown only the bookmarks inside it that repeat that name would answer
   * a question nobody asked.
   */
  viaFolder?: boolean;
}

export interface WidenedSearchData {
  bookmarks: FoldedBookmark[];
  folders: BookmarkFolder[];
}

/** What the apps listing needs to know about the browser to order itself. */
export interface EnvContext {
  /** When each environment's host was last looked at. */
  usage: EnvUsage;
  /** The host of the page being browsed, which sorts to the bottom. */
  currentHost: string | null;
}

const NO_ENV_CONTEXT: EnvContext = { usage: {}, currentHost: null };

export function buildFavoritesListing(
  favorites: StarredPage[],
  quickTasks: StarredPage[],
  query: string,
  widened: WidenedSearchData = { bookmarks: [], folders: [] },
  apps: AppEntry[] = [],
  envContext: EnvContext = NO_ENV_CONTEXT
): FavoritesListing {
  const parsed = parseFavoritesQuery(query);

  if (parsed.scope === 'commands') {
    return buildSections([
      {
        label: 'Commands',
        indent: false,
        rows: matchCommands(QUICK_COMMANDS, parsed.term).map((command) => ({
          kind: 'command',
          command,
          text: parsed.term
        }))
      }
    ]);
  }

  if (parsed.scope === 'apps') {
    return buildAppsListing(apps, parsed.term, envContext);
  }

  if (parsed.scope === 'all') {
    return buildWidenedListing(widened, parsed.term);
  }

  // One row per app whatever its environments, so a handful of apps cannot
  // push the favorites off the list between them.
  const appQuery = parseAppQuery(parsed.term, apps);
  const appRows: FavoritesRow[] = matchApps(apps, appQuery.appTerm).map(
    (app) => ({ kind: 'app', app, envTerm: appQuery.envTerm })
  );

  const rankedFavorites = rankFavorites(favorites, parsed.term);
  // A quick task already in the favorites would otherwise appear twice.
  const chosen = new Set(rankedFavorites.map((page) => page.url));
  const rankedQuickTasks = rankFavorites(quickTasks, parsed.term).filter(
    (page) => !chosen.has(page.url)
  );

  return buildSections([
    { label: null, indent: false, rows: toPageRows(rankedFavorites) },
    { label: 'Apps', indent: false, rows: appRows },
    {
      label: 'Quick tasks',
      indent: false,
      rows: toPageRows(rankedQuickTasks)
    }
  ]);
}

/**
 * Folders first, then the bookmarks themselves grouped by folder.
 *
 * Folders lead because they are the shorter list and the one that stays useful
 * as the collection grows.
 */
function buildWidenedListing(
  widened: WidenedSearchData,
  term: string
): FavoritesListing {
  const folderRows: FavoritesRow[] = widened.folders.map((folder) => ({
    kind: 'folder',
    folder
  }));

  const parts: {
    label: string | null;
    indent: boolean;
    rows: FavoritesRow[];
  }[] = [{ label: 'Folders', indent: false, rows: folderRows }];

  const byUrl = new Map(
    widened.bookmarks.map((entry) => [entry.page.url, entry])
  );

  // Contents of a matched folder come through whole and first; everything else
  // still has to earn its place by matching.
  const fromFolders = widened.bookmarks
    .filter((entry) => entry.viaFolder)
    .map((entry) => entry.page);
  const matchedDirectly = rankFavorites(
    widened.bookmarks
      .filter((entry) => !entry.viaFolder)
      .map((entry) => entry.page),
    term
  );

  const groups: { label: string; rows: FavoritesRow[] }[] = [];
  const byFolder = new Map<string, { label: string; rows: FavoritesRow[] }>();
  const placed = new Set<string>();

  for (const page of [...fromFolders, ...matchedDirectly]) {
    if (placed.has(page.url)) {
      continue;
    }
    placed.add(page.url);
    const folder = byUrl.get(page.url)?.folder ?? '';
    const existing = byFolder.get(folder);
    const row: FavoritesRow = { kind: 'page', page };
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    const group = { label: folder || 'Bookmarks', rows: [row] };
    byFolder.set(folder, group);
    groups.push(group);
  }

  for (const group of groups) {
    parts.push({ label: group.label, indent: true, rows: group.rows });
  }

  return buildSections(parts);
}

/**
 * Walking into the apps: the apps themselves, then one app's environments.
 *
 * Environments come back as ordinary page rows under a divider carrying the
 * app's name, exactly as a bookmark folder's contents do in the widened
 * listing. They are pages — a name and an address — so every surface already
 * knows how to draw, icon and open them, and the app they belong to is said
 * once on the divider rather than repeated on every row.
 */
function buildAppsListing(
  apps: AppEntry[],
  term: string,
  envContext: EnvContext
): FavoritesListing {
  const { appTerm, envTerm } = parseAppQuery(term, apps);
  const matched = matchApps(apps, appTerm);

  const offerApps = (): FavoritesListing =>
    buildSections([
      {
        label: 'Apps',
        indent: false,
        rows: matched.map((app) => ({ kind: 'app-folder', app }))
      }
    ]);

  // Nothing named yet: the apps are the useful answer, the way the folders are
  // in a widened search with nothing typed.
  if (appTerm.trim() === '') {
    return offerApps();
  }

  const needle = envTerm === null ? '' : envToken(envTerm);
  const parts = matched.map((app) => ({
    label: app.name,
    indent: true,
    rows: orderEnvironmentsForSwitching(
      app.environments,
      envContext.usage,
      envContext.currentHost
    )
      .filter(
        (environment) =>
          needle === '' || envToken(environment.name).includes(needle)
      )
      .map(
        (environment): FavoritesRow => ({ kind: 'app-env', app, environment })
      )
  }));

  const listing = buildSections(parts);
  // An app matched but nothing inside it did. Showing the app is more use than
  // showing an empty list, because it says the app exists and is reachable.
  return listing.rows.length === 0 ? offerApps() : listing;
}

function toPageRows(pages: StarredPage[]): FavoritesRow[] {
  return pages.map((page) => ({ kind: 'page', page }));
}

function buildSections(
  parts: { label: string | null; indent: boolean; rows: FavoritesRow[] }[]
): FavoritesListing {
  const sections: FavoritesSection[] = [];
  const rows: FavoritesRow[] = [];

  for (const part of parts) {
    if (part.rows.length === 0) {
      continue;
    }
    sections.push({ ...part, startIndex: rows.length });
    rows.push(...part.rows);
  }

  return { sections, rows };
}

/** The key a row renders under, unique across every kind. */
export function rowKey(row: FavoritesRow): string {
  if (row.kind === 'page') {
    return `page:${row.page.url}`;
  }
  if (row.kind === 'command') {
    return `command:${row.command.id}`;
  }
  if (row.kind === 'app-folder') {
    return `app-folder:${row.app.name}`;
  }
  if (row.kind === 'app-env') {
    return `app-env:${row.app.name}:${row.environment.name}`;
  }
  return row.kind === 'folder'
    ? `folder:${row.folder.id}`
    : `app:${row.app.name}`;
}

/** What a row says on screen. */
export function rowLabel(row: FavoritesRow): string {
  if (row.kind === 'page') {
    return row.page.label;
  }
  if (row.kind === 'command') {
    return row.command.usage;
  }
  if (row.kind === 'app-folder') {
    return row.app.name;
  }
  if (row.kind === 'app-env') {
    return row.environment.name;
  }
  return row.kind === 'folder' ? row.folder.title : row.app.name;
}

/**
 * The address an app row currently points at, given how many times Tab has been
 * pressed on it. Null for a row that is not an app, or an app with nothing in
 * it yet.
 */
export function appRowTarget(row: FavoritesRow, step = 0) {
  return row.kind === 'app'
    ? resolveAppTarget(row.app, row.envTerm, step)
    : null;
}

/** The second line: an address, a folder's location, or an app's environment. */
export function rowDetail(row: FavoritesRow, step = 0): string {
  if (row.kind === 'page') {
    return row.page.url;
  }
  if (row.kind === 'command') {
    return row.command.description;
  }
  if (row.kind === 'app-env') {
    return row.environment.url;
  }
  if (row.kind === 'app-folder') {
    const count = row.app.environments.length;
    return count === 0
      ? 'No environments yet'
      : `${count} environment${count === 1 ? '' : 's'}`;
  }
  if (row.kind === 'app') {
    const target = appRowTarget(row, step);
    if (target === null) {
      return 'No environments yet';
    }
    const suffix = target.isDerived ? ' · suggested' : '';
    return `${target.environment.name} · ${target.environment.url}${suffix}`;
  }
  const count = `${row.folder.count} bookmark${row.folder.count === 1 ? '' : 's'}`;
  return row.folder.path ? `${row.folder.path} · ${count}` : count;
}
