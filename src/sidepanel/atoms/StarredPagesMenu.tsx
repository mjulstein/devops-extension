import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import classes from './StarredPagesMenu.module.css';
import type { StarredPage } from '../starredPages';

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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Match on label and address: the address is often what you remember.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return pages;
    }
    return pages.filter(
      (page) =>
        page.label.toLowerCase().includes(needle) ||
        page.url.toLowerCase().includes(needle)
    );
  }, [pages, query]);

  useEffect(() => {
    if (focusRequest === 0) {
      return;
    }
    // Opening and focusing are deferred a frame apart: the search input does not
    // exist until the render that opens the menu has committed, so focusing in
    // the same tick would find nothing.
    let focusFrame = 0;
    const openFrame = requestAnimationFrame(() => {
      setIsOpen(true);
      setQuery('');
      focusFrame = requestAnimationFrame(() => {
        searchRef.current?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(openFrame);
      cancelAnimationFrame(focusFrame);
    };
  }, [focusRequest]);

  // A dropdown in a 360px panel must not linger once attention moves on.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onDocumentPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocumentPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={classes.wrap} ref={wrapRef}>
      <button
        type="button"
        className={classes.trigger}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
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
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter opens the best match, so the shortcut can be used without
              // ever touching the mouse.
              if (event.key === 'Enter' && visible[0]) {
                event.preventDefault();
                setIsOpen(false);
                void onOpenStarredPage(visible[0].url);
              }
            }}
          />
          {visible.length === 0 ? (
            <p className={classes.empty}>
              {pages.length === 0
                ? 'No other favorites to open.'
                : 'Nothing matches that search.'}
            </p>
          ) : (
            visible.map((page) => (
              <button
                key={page.url}
                type="button"
                role="menuitem"
                className={clsx(classes.item)}
                title={page.url}
                onClick={() => {
                  setIsOpen(false);
                  void onOpenStarredPage(page.url);
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
