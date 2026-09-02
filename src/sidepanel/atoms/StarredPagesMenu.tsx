import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import classes from './StarredPagesMenu.module.css';
import type { StarredPage } from '../starredPages';

interface StarredPagesMenuProps {
  /**
   * Favorites to offer, already excluding the page currently open — starring is
   * the neighbouring toggle's job, not this menu's.
   */
  pages: StarredPage[];
  onOpenStarredPage: (url: string) => Promise<void>;
}

export function StarredPagesMenu({
  pages,
  onOpenStarredPage
}: StarredPagesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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
          {pages.length === 0 ? (
            <p className={classes.empty}>No other favorites to open.</p>
          ) : (
            pages.map((page) => (
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
