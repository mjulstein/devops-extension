// A centred favorites palette drawn over the page.
//
// This runs inside Azure DevOps's own document, which is why it is built by hand
// rather than with the side panel's React components.
//
// The shadow root is for layout, not for colour. The host page's rules cannot
// reach in and break the dialog, but CSS custom properties are inherited
// properties and cross the boundary freely — so every colour here reads Azure
// DevOps's own theme variables and falls back to a light default only when they
// are absent. The palette therefore follows the page into dark mode without
// knowing anything about themes. Do not reintroduce `all: initial` on the host:
// it severs exactly that inheritance.
//
// The payoff for living in the page is focus. The page's document already has
// focus — it is what the user is looking at — so the search field simply takes
// it, with none of the retrying the side panel needs.

import { wantsNewTab, type StarredPage } from '@/sidepanel/starredPages';
import {
  buildPaletteView,
  resolvePaletteKey,
  type PaletteView
} from './paletteModel';

const HOST_ID = 'devops-ext-favorites-palette';

export interface PaletteOptions {
  favorites: StarredPage[];
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
    background: var(--background-color, #fff);
    color: var(--text-primary-color, #1f2328);
    border: 1px solid var(--palette-neutral-20, #d0d7de);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgb(31 35 40 / 32%);
    overflow: hidden;
  }
  .search {
    font: inherit;
    font-size: 15px;
    padding: 12px 14px;
    border: none;
    border-block-end: 1px solid var(--palette-neutral-20, #d0d7de);
    background: transparent;
    color: inherit;
    outline: none;
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
  .row:hover { background: var(--palette-neutral-4, #f3f4f6); }
  .rowHighlighted, .rowHighlighted:hover {
    background: var(--communication-background, #ddeaff);
    color: var(--text-on-communication-background, #0a3977);
  }
  .url {
    font-size: 11px;
    color: var(--text-secondary-color, #6e7781);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    padding: 14px;
    font-size: 13px;
    color: var(--text-secondary-color, #6e7781);
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
  onOpenPage,
  container = document.body
}: PaletteOptions): PaletteHandle {
  closeFavoritesPalette(container);

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLES;

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Search favorites');

  const search = document.createElement('input');
  search.className = 'search';
  search.type = 'text';
  search.placeholder = 'Search favorites';
  search.setAttribute('aria-label', 'Search favorites');

  const list = document.createElement('div');
  list.className = 'list';

  dialog.append(search, list);
  backdrop.append(dialog);
  shadow.append(style, backdrop);
  container.append(host);

  let view: PaletteView = buildPaletteView(favorites, '', 0);

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

    view.rows.forEach((page, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = index === view.highlight ? 'row rowHighlighted' : 'row';
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

    list.children[view.highlight]?.scrollIntoView({ block: 'nearest' });
  }

  search.addEventListener('input', () => {
    view = buildPaletteView(favorites, search.value, 0);
    render();
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
