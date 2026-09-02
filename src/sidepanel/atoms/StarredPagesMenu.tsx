import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import classes from './StarredPagesMenu.module.css';
import type { StarredPage } from '../starredPages';

interface StarredPagesMenuProps {
  pages: StarredPage[];
  /** Whether the active tab is an Azure DevOps page that can be starred. */
  canStarActivePage: boolean;
  isActivePageStarred: boolean;
  onToggleStarActivePage: () => Promise<void>;
  onOpenStarredPage: (url: string) => Promise<void>;
}

export function StarredPagesMenu({
  pages,
  canStarActivePage,
  isActivePageStarred,
  onToggleStarActivePage,
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
        <span aria-hidden="true" className={classes.star}>
          {pages.length > 0 ? '★' : '☆'}
        </span>
        Starred
        <span className={classes.count}>{pages.length || ''}</span>
        <span aria-hidden="true" className={classes.caret}>
          ▾
        </span>
      </button>

      {isOpen && (
        <div className={classes.menu} role="menu">
          <div className={classes.toggleRow}>
            <button
              type="button"
              role="menuitem"
              className={classes.item}
              disabled={!canStarActivePage}
              title={
                canStarActivePage
                  ? 'Star or unstar the page in the active tab'
                  : 'The active tab is not an Azure DevOps page'
              }
              onClick={() => {
                void onToggleStarActivePage();
              }}
            >
              {isActivePageStarred ? '★ Unstar this page' : '☆ Star this page'}
            </button>
          </div>

          {pages.length === 0 ? (
            <p className={classes.empty}>
              Nothing starred yet. Open an Azure DevOps page and star it.
            </p>
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
