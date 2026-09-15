import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import classes from './StarredPagesMenu.module.css';
import { rankFavorites, wantsNewTab, type StarredPage } from '../starredPages';
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

/** How long to keep trying to place the cursor, and how often. */
const FOCUS_ATTEMPTS = 20;
const FOCUS_RETRY_MS = 60;

/**
 * How long the menu may sit untouched before closing itself.
 *
 * A side panel can lose focus without any event this document can see, which
 * leaves the menu covering the panel with no click of yours able to reach it.
 * Closing on its own is the safety net for that.
 */
const IDLE_CLOSE_MS = 5000;

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
  onOpenStarredPage: (url: string, newTab: boolean) => Promise<void>;
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
  // Bumped every time the cursor should go back to the search box: opening the
  // menu, and pressing the shortcut again while it is already open.
  const [focusToken, setFocusToken] = useState(0);
  // Whether the search has actually taken focus, which decides whether losing
  // window focus means "the user clicked away" or "focus never arrived".
  const isFocusSettledRef = useRef(false);
  const idleTimerRef = useRef(0);

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
    setFocusToken((token) => token + 1);
  }

  function close() {
    setIsOpen(false);
    isFocusSettledRef.current = false;
    window.clearTimeout(idleTimerRef.current);
  }

  /**
   * Restarts the idle countdown. Called from the menu's own events rather than
   * the document's, so activity anywhere else in the panel still counts as
   * leaving the menu alone.
   */
  function markActivity() {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      isFocusSettledRef.current = false;
    }, IDLE_CLOSE_MS);
  }

  async function openPage(
    url: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) {
    close();
    await onOpenStarredPage(url, wantsNewTab(event));
  }

  // The search box is the point of the menu, so it takes focus however the menu
  // was opened — mouse or shortcut.
  //
  // One `focus()` call is not enough. When the browser opens the side panel from
  // a keyboard command, the panel's window does not necessarily hold focus yet,
  // and focusing an element inside an unfocused document does not route
  // keystrokes to it — which is why typing only worked after a click somewhere
  // in the panel. So the request is retried on a short timer, and again whenever
  // the panel gains focus, until the input really holds it.
  useEffect(() => {
    if (!isOpen || focusToken === 0) {
      return;
    }

    let attempts = 0;
    let timer = 0;

    function attemptFocus() {
      const input = searchRef.current;
      if (!input) {
        return;
      }
      input.focus();
      attempts += 1;
      const hasFocus = document.activeElement === input && document.hasFocus();
      if (hasFocus) {
        isFocusSettledRef.current = true;
        return;
      }
      if (attempts < FOCUS_ATTEMPTS) {
        timer = window.setTimeout(attemptFocus, FOCUS_RETRY_MS);
      }
    }

    isFocusSettledRef.current = false;
    timer = window.setTimeout(attemptFocus, 0);
    window.addEventListener('focus', attemptFocus);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', attemptFocus);
    };
  }, [isOpen, focusToken]);

  // A press of the shortcut opens the menu, and a second press while it is
  // already open puts the cursor back in the search rather than doing nothing.
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
      setFocusToken((token) => token + 1);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [focusRequest]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    markActivity();
    return () => {
      window.clearTimeout(idleTimerRef.current);
    };
    // Restarted by the menu's own handlers; this only starts the first count.
  }, [isOpen, focusToken]);

  // Clicking outside the side panel entirely — anywhere in the page — should
  // dismiss the menu like clicking elsewhere in the panel does. The pointer
  // never reaches this document in that case; losing window focus is the only
  // signal. Only acted on once the search has actually taken focus, so the
  // retries above cannot close the menu they are trying to focus.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onWindowBlur() {
      if (isFocusSettledRef.current) {
        close();
      }
    }
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [isOpen]);

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
        void openPage(target.url, event);
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
          onMouseMove={markActivity}
          onKeyDown={markActivity}
          onPointerDown={markActivity}
        >
          <div className={classes.searchRow}>
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
            {/* The menu can fill the panel, so it needs a way out that does not
                depend on finding panel left uncovered to click. */}
            <button
              type="button"
              className={classes.closeButton}
              aria-label="Close favorites"
              title="Close"
              onClick={close}
            >
              ✕
            </button>
          </div>

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
                onClick={(event) => {
                  void openPage(page.url, event);
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
