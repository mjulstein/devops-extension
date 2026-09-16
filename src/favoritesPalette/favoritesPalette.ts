// A centred favorites palette drawn over the page.
//
// This runs inside Azure DevOps's own document, which is why it is built by hand
// rather than with the side panel's React components.
//
// The shadow root is for layout, not for colour. The host page's rules cannot
// reach in and break the dialog, but CSS custom properties are inherited
// properties and cross the boundary freely.
//
// Colour therefore resolves in three steps: the panel's own tokens first, when
// they were passed in; then Azure DevOps's page variables, so the dialog is
// still themed with the page when they were not; then a light literal. Do not
// reintroduce `all: initial` on the host — it severs the inheritance the middle
// step depends on.
//
// The payoff for living in the page is focus. The page's document already has
// focus — it is what the user is looking at — so the search field simply takes
// it, with none of the retrying the side panel needs.

import { wantsNewTab, type StarredPage } from '@/sidepanel/starredPages';
import type { FoldedBookmark } from '@/sidepanel/favoritesListing';
import {
  buildPaletteView,
  resolvePaletteKey,
  type PaletteView
} from './paletteModel';
import { parseFavoritesQuery } from '@/sidepanel/favoritesQuery';

const HOST_ID = 'devops-ext-favorites-palette';

export interface PaletteOptions {
  favorites: StarredPage[];
  /** Quick tasks in progress, listed under the favorites behind a divider. */
  quickTasks?: StarredPage[];
  /**
   * Widened search, used when the query starts with the scope character. A page
   * cannot read bookmarks itself, so the caller supplies this — in the extension
   * it is a round trip to the service worker.
   */
  searchAllBookmarks?: (term: string) => Promise<FoldedBookmark[]>;
  /**
   * Opens the browser's own bookmark manager. A page cannot navigate to a
   * browser page, so this too is the caller's job.
   */
  onOpenBookmarkManager?: () => void;
  /**
   * The side panel's resolved colour tokens, so the dialog matches the panel
   * rather than only the page. Absent, it falls back to Azure DevOps's own
   * variables, which is still a themed dialog.
   */
  tokens?: Record<string, string>;
  /**
   * Called with the chosen page's url, and whether the user asked for a new tab
   * (Ctrl or Cmd). The palette closes first either way.
   */
  onOpenPage: (url: string, newTab: boolean) => void;
  /** Where to attach. Defaults to the document body. */
  container?: HTMLElement;
}

export interface PaletteHandle {
  close: () => void;
}

const STYLES = `
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-block-start: 12vh;
    background: rgb(27 31 36 / 32%);
    font-family: var(--fontFamily, "Segoe UI", Arial, sans-serif);
  }
  .dialog {
    width: min(620px, 92vw);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--color-surface, var(--background-color, #fff));
    color: var(--color-text, var(--text-primary-color, #1f2328));
    border: 1px solid var(--color-border, var(--palette-neutral-20, #d0d7de));
    border-radius: 10px;
    box-shadow: 0 16px 48px rgb(31 35 40 / 32%);
    overflow: hidden;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-inline-end: 10px;
    border-block-end: 1px solid var(--color-border, var(--palette-neutral-20, #d0d7de));
  }
  .search {
    font: inherit;
    font-size: 15px;
    flex: 1 1 auto;
    min-width: 0;
    padding: 12px 14px;
    border: none;
    background: transparent;
    color: inherit;
    outline: none;
  }
  .manage {
    font: inherit;
    font-size: 12px;
    flex: 0 0 auto;
    padding: 5px 9px;
    border: 1px solid var(--color-border, var(--palette-neutral-20, #d0d7de));
    border-radius: 6px;
    background: var(--color-surface-raised, transparent);
    color: inherit;
    cursor: pointer;
  }
  .manage:hover {
    border-color: var(--color-border-strong, #8b949e);
  }
  .list { overflow-y: auto; }
  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    text-align: start;
    font: inherit;
    font-size: 13px;
    padding: 8px 14px;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
  }
  .row:hover { background: var(--color-surface-hover, var(--palette-neutral-4, #f3f4f6)); }
  .rowHighlighted, .rowHighlighted:hover {
    background: var(--color-accent-surface-strong, var(--communication-background, #ddeaff));
    color: var(--color-accent-strong, var(--text-on-communication-background, #0a3977));
  }
  /* The muted grey a url uses on the plain ground is unreadable on the
     highlight, so it takes the row's own colour and steps back with weight
     instead of with contrast. */
  .rowHighlighted .url {
    color: inherit;
    opacity: 0.85;
  }
  .url {
    font-size: 11px;
    color: var(--color-text-muted, var(--text-secondary-color, #6e7781));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* A visible break: what is below it is work in progress, not a place you
     chose, and the search never reorders across it. */
  /* One line: a label with a rule running off it, so a group reads as a break
     without costing the height of a row. */
  .divider {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-text-muted, var(--text-secondary-color, #6e7781));
    padding: 6px 14px;
  }
  .divider::after {
    content: '';
    flex: 1 1 auto;
    border-block-start: 1px solid var(--color-border, var(--palette-neutral-20, #d0d7de));
  }
  .indented { padding-inline-start: 28px; }
  .empty {
    padding: 14px;
    font-size: 13px;
    color: var(--color-text-muted, var(--text-secondary-color, #6e7781));
  }
`;

/**
 * Opens the palette, replacing one already on screen.
 *
 * Returns a handle rather than a promise: the caller's job ends once it is open,
 * and dismissal is driven from inside.
 */
export function openFavoritesPalette({
  favorites,
  quickTasks = [],
  onOpenPage,
  searchAllBookmarks,
  onOpenBookmarkManager,
  tokens,
  container = document.body
}: PaletteOptions): PaletteHandle {
  closeFavoritesPalette(container);

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLES;

  // Set on the host so they are inherited into the shadow tree, where the
  // dialog's own rules read them ahead of the page's.
  for (const [token, value] of Object.entries(tokens ?? {})) {
    host.style.setProperty(`--${token}`, value);
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Search favorites');

  const search = document.createElement('input');
  search.className = 'search';
  search.type = 'text';
  search.placeholder = 'Search favorites — . for all bookmarks';
  search.setAttribute('aria-label', 'Search favorites');

  const list = document.createElement('div');
  list.className = 'list';

  const header = document.createElement('div');
  header.className = 'header';
  header.append(search);

  if (onOpenBookmarkManager) {
    // Where a bookmark gets renamed, moved or deleted — none of which belongs in
    // a search box, and all of which people come looking for once the widened
    // search shows them everything they have.
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'manage';
    manage.textContent = 'Bookmarks';
    manage.title = "Open the browser's bookmark manager";
    manage.addEventListener('click', () => {
      close();
      onOpenBookmarkManager();
    });
    header.append(manage);
  }

  dialog.append(header, list);
  backdrop.append(dialog);
  shadow.append(style, backdrop);
  container.append(host);

  let allBookmarks: FoldedBookmark[] = [];
  let view: PaletteView = buildPaletteView(favorites, '', 0, quickTasks);

  function close() {
    host.remove();
    document.removeEventListener('keydown', onDocumentKeyDown, true);
  }

  function openRow(index: number, event: MouseEvent | KeyboardEvent) {
    const target = view.rows[index];
    if (!target) {
      return;
    }
    close();
    onOpenPage(target.url, wantsNewTab(event));
  }

  function render() {
    list.replaceChildren();

    if (view.rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent =
        favorites.length === 0
          ? 'No favorites yet. Star a page from the side panel.'
          : 'Nothing matches that search.';
      list.append(empty);
      return;
    }

    const sectionStarts = new Map(
      view.sections
        .filter((section) => section.label !== null)
        .map((section) => [section.startIndex, section])
    );
    const indentedFrom = view.sections.filter((section) => section.indent);

    view.rows.forEach((page, index) => {
      const section = sectionStarts.get(index);
      if (section) {
        const divider = document.createElement('div');
        divider.className = 'divider';
        divider.setAttribute('role', 'separator');
        divider.textContent = section.label;
        list.append(divider);
      }

      const row = document.createElement('button');
      row.type = 'button';
      // Assigned in one go: setting className afterwards would drop the indent
      // class again, which is exactly what it did.
      row.className = [
        'row',
        index === view.highlight ? 'rowHighlighted' : '',
        indentedFrom.some(
          (part) =>
            index >= part.startIndex &&
            index < part.startIndex + part.rows.length
        )
          ? 'indented'
          : ''
      ]
        .filter(Boolean)
        .join(' ');
      row.title = page.url;

      const label = document.createElement('span');
      label.textContent = page.label;
      const url = document.createElement('span');
      url.className = 'url';
      url.textContent = page.url;

      row.append(label, url);
      row.addEventListener('mouseenter', () => {
        view = { ...view, highlight: index };
        render();
      });
      row.addEventListener('click', (event) => openRow(index, event));
      list.append(row);
    });

    list
      .querySelectorAll('.row')
      [view.highlight]?.scrollIntoView({ block: 'nearest' });
  }

  function rebuild() {
    view = buildPaletteView(
      favorites,
      search.value,
      0,
      quickTasks,
      allBookmarks
    );
    render();
  }

  search.addEventListener('input', () => {
    rebuild();

    const parsed = parseFavoritesQuery(search.value);
    if (parsed.scope !== 'all' || !searchAllBookmarks) {
      return;
    }
    const asked = search.value;
    void searchAllBookmarks(parsed.term).then((results) => {
      // Ignore an answer to a query the user has already typed past.
      if (search.value === asked) {
        allBookmarks = results;
        rebuild();
      }
    });
  });

  // Captured on the document, and stopped there. Azure DevOps binds plenty of
  // bare keys of its own, and Enter or Escape reaching the page underneath
  // would be worse than having no palette at all.
  function onDocumentKeyDown(event: KeyboardEvent) {
    const action = resolvePaletteKey(event.key, view);
    if (action.kind === 'ignore') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action.kind === 'close') {
      close();
      return;
    }
    if (action.kind === 'move') {
      view = { ...view, highlight: action.highlight };
      render();
      return;
    }
    openRow(action.index, event);
  }

  document.addEventListener('keydown', onDocumentKeyDown, true);

  // Azure DevOps binds single letters as page shortcuts, and skips them when the
  // keystroke came from an input. Our input is inside a shadow root, so by the
  // time the event reaches the page's listeners it has been retargeted to the
  // host element — not an input, as far as the page can tell — and the page
  // acted on letters that were meant for the search box. That is why only the
  // letters Azure DevOps does not bind could be typed. Stopping key events at
  // the host keeps them from ever reaching those listeners; the input still gets
  // them, because it is deeper than the point they are stopped at, and the
  // navigation handler above runs earlier still, in the capture phase.
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    host.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  }
  backdrop.addEventListener('mousedown', (event) => {
    // Only the backdrop itself — a click inside the dialog is not a dismissal.
    if (event.target === backdrop) {
      close();
    }
  });

  render();
  search.focus();

  return { close };
}

/** Removes a palette if one is open. Safe to call when none is. */
export function closeFavoritesPalette(container: HTMLElement = document.body) {
  container.querySelector(`#${HOST_ID}`)?.remove();
}
