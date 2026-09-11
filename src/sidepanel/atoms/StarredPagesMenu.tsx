import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import classes from './StarredPagesMenu.module.css';
import { rankFavorites, type StarredPage } from '../starredPages';
import { getFavoriteIconUrl } from '../favoriteIcon';

/**
 * The box the menu should fill: the panel itself, edge to edge.
 *
 * Not the trigger, which is one control in a row, and not the header either —
 * the header sits inside the panel's padding, so matching it leaves the menu
 * inset by that padding on top of its own, which reads as a double margin. The
 * panel root's rect includes the padding, so the menu reaches the panel edges.
 *
 * Read from the panel root rather than the viewport so the dev harness, where
 * the panel is a framed region rather than the whole window, lines up too.
 */
function getPanelRect(trigger: HTMLElement): DOMRect {
  const panel = trigger.closest('header')?.parentElement;
  return (panel ?? document.documentElement).getBoundingClientRect();
}

interface MenuBox {
  top: number;
  left: number;
  width: number;
}

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
  // The menu is as wide as the side panel, not as wide as its trigger: the
  // trigger is one control in a row, while the entries are long URLs that have
  // nowhere to go in that width. Measured rather than styled because the popup
  // has to escape the trigger's box to get there.
  const [box, setBox] = useState<MenuBox | null>(null);

  // Title matches rank above address matches — see rankFavorites.
  const visible = useMemo(() => rankFavorites(pages, query), [pages, query]);

  function measure() {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const panel = getPanelRect(wrap);
    setBox({
      top: wrap.getBoundingClientRect().bottom + 4,
      left: panel.left,
      width: panel.width
    });
  }

  function open() {
    measure();
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
    // Inlined rather than calling open(), so this effect depends on nothing
    // that changes every render.
    const frame = requestAnimationFrame(() => {
      measure();
      setIsOpen(true);
      setQuery('');
      setHighlight(0);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [focusRequest]);

  // A side panel is resized by dragging its edge, which does not reopen the
  // menu, so the width has to follow.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [isOpen]);

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
        <div
          className={classes.menu}
          role="menu"
          style={
            box ? { top: box.top, left: box.left, width: box.width } : undefined
          }
        >
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
                <FavoriteIcon url={page.url} />
                <span className={classes.itemText}>
                  {page.label}
                  <span className={classes.itemUrl}>{page.url}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The page's icon from the browser's favicon cache.
 *
 * Kept silent on failure: an icon is a scanning aid, and a broken-image glyph
 * beside a favorite would be worse than the blank space it replaces.
 */
function FavoriteIcon({ url }: { url: string }) {
  const [isBroken, setIsBroken] = useState(false);
  const source = useMemo(() => getFavoriteIconUrl(url), [url]);

  if (source === null || isBroken) {
    return <span className={classes.iconPlaceholder} aria-hidden="true" />;
  }

  return (
    <img
      className={classes.icon}
      src={source}
      alt=""
      width={16}
      height={16}
      onError={() => setIsBroken(true)}
    />
  );
}
