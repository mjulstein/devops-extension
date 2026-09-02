import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import classes from './StarredPagesMenu.module.css';
import { rankFavorites, type StarredPage } from '../starredPages';

interface StarredPagesMenuProps {
  /**
   * Favorites to offer, already excluding the page currently open — starring is
   * the neighbouring toggle's job, not this menu's.
   */
  pages: StarredPage[];
  /**
   * Incremented by the keyboard shortcut. A counter rather than a boolean so a
   * second press re-opens and re-focuses even if the menu is already open.
   */
  focusRequest: number;
  onOpenStarredPage: (url: string) => Promise<void>;
}

export function StarredPagesMenu({
  pages,
  focusRequest,
  onOpenStarredPage
}: StarredPagesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Which row the keyboard is on. Reset whenever the result set changes, so it
  // can never point past the end of the list.
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const itemElementsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Title matches rank above address matches — see rankFavorites.
  const visible = useMemo(() => rankFavorites(pages, query), [pages, query]);

  function open() {
    setIsOpen(true);
    setQuery('');
    setHighlight(0);
  }

  function close() {
    setIsOpen(false);
  }

  async function openPage(url: string) {
    close();
    await onOpenStarredPage(url);
  }

  // The search box is the point of the menu, so it takes focus however the menu
  // was opened — mouse or shortcut. Deferred a frame because the input does not
  // exist until the render that opens the menu has committed.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  // A second press of the shortcut re-opens and clears the previous search.
  useEffect(() => {
    if (focusRequest === 0) {
      return;
    }
    const frame = requestAnimationFrame(open);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [focusRequest]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onDocumentPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', onDocumentPointerDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown);
    };
  }, [isOpen]);

  /** Arrow keys move the highlight; Enter opens it; Escape closes. */
  function onNavigationKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (visible.length === 0) {
        return;
      }
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = (highlight + delta + visible.length) % visible.length;
      setHighlight(next);
      // Keep the highlighted row in view in a short, scrollable menu.
      itemElementsRef.current[next]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter') {
      const target = visible[highlight] ?? visible[0];
      if (target) {
        event.preventDefault();
        void openPage(target.url);
      }
    }
  }

  return (
    <div className={classes.wrap} ref={wrapRef}>
      <button
        type="button"
        className={classes.trigger}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => (isOpen ? close() : open())}
        title="Starred Azure DevOps pages"
      >
        Starred
        <span className={classes.count}>{pages.length || ''}</span>
        <span aria-hidden="true" className={classes.caret}>
          ▾
        </span>
      </button>

      {isOpen && (
        <div className={classes.menu} role="menu">
          <input
            ref={searchRef}
            className={classes.search}
            type="text"
            value={query}
            placeholder="Search favorites"
            aria-label="Search favorites"
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={onNavigationKeyDown}
          />

          {visible.length === 0 ? (
            <p className={classes.empty}>
              {pages.length === 0
                ? 'No other favorites to open.'
                : 'Nothing matches that search.'}
            </p>
          ) : (
            visible.map((page, index) => (
              <button
                key={page.url}
                type="button"
                role="menuitem"
                ref={(element) => {
                  itemElementsRef.current[index] = element;
                }}
                className={clsx(
                  classes.item,
                  index === highlight && classes.itemHighlighted
                )}
                title={page.url}
                onMouseEnter={() => setHighlight(index)}
                onKeyDown={onNavigationKeyDown}
                onClick={() => {
                  void openPage(page.url);
                }}
              >
                {page.label}
                <span className={classes.itemUrl}>{page.url}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
