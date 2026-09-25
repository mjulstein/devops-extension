import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import classes from './StarredPagesMenu.module.css';
import { wantsNewTab, type StarredPage } from '../starredPages';
import {
  buildFavoritesListing,
  rowDetail,
  rowKey,
  rowLabel,
  type FavoritesListing,
  type FavoritesRow,
  type WidenedSearchData
} from '../favoritesListing';
import { parseFavoritesQuery } from '../favoritesQuery';
import { searchAllBookmarks } from '../bookmarkSync';
import { getFavoriteIconUrl } from '../favoriteIcon';
import { Button } from './Button';

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
  // Marked on the panel root rather than inferred from the markup around the
  // trigger, which has already moved once and would silently take the menu's
  // width with it.
  const panel = trigger.closest('[data-panel-root]');
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
   * Quick tasks currently in progress. Listed after the favorites and never
   * mixed in: a favorite is a place you chose, a quick task is work that is open
   * right now and will disappear when it is done.
   */
  quickTaskPages: StarredPage[];
  /**
   * Incremented by the keyboard shortcut. A counter rather than a boolean so a
   * second press re-opens and re-focuses even if the menu is already open.
   */
  focusRequest: number;
  onOpenStarredPage: (url: string, newTab: boolean) => Promise<void>;
  /**
   * Opens the favorites search wherever it belongs — the palette over an Azure
   * DevOps page, this menu otherwise. Resolves false when this menu is the
   * answer, which is when it opens itself.
   */
  onRequestFavoritesSearch: () => Promise<boolean>;
}

export function StarredPagesMenu({
  pages,
  quickTaskPages,
  focusRequest,
  onOpenStarredPage,
  onRequestFavoritesSearch
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
  // Results of a widened search. Fetched rather than held, because "every
  // bookmark" is the browser's list and can change while the menu is open.
  const [widened, setWidened] = useState<WidenedSearchData>({
    bookmarks: [],
    folders: []
  });
  // Bumped every time the cursor should go back to the search box: opening the
  // menu, and pressing the shortcut again while it is already open.
  const [focusToken, setFocusToken] = useState(0);
  // Whether the search has actually taken focus, which decides whether losing
  // window focus means "the user clicked away" or "focus never arrived".
  const isFocusSettledRef = useRef(false);
  const idleTimerRef = useRef(0);

  // Title matches rank above address matches — see rankFavorites.
  const listing = useMemo(
    () => buildFavoritesListing(pages, quickTaskPages, query, widened),
    [pages, quickTaskPages, query, widened]
  );
  const visible = listing.rows;

  function measure() {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const panel = getPanelRect(wrap);
    // Measuring is a DOM read whose only product is this state, and one caller
    // is an effect — which is what the rule below objects to.
    // eslint-disable-next-line @eslint-react/set-state-in-effect
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

  /**
   * Acts on a row. A page is somewhere to go; a folder is somewhere to look, so
   * picking one retypes the search as its name and the menu stays open.
   */
  async function activateRow(
    entry: FavoritesRow,
    event: React.MouseEvent | React.KeyboardEvent
  ) {
    if (entry.kind === 'folder') {
      setQuery(`.${entry.folder.title}`);
      setHighlight(0);
      searchRef.current?.focus();
      return;
    }
    await openPage(entry.page.url, event);
  }

  async function openPage(
    url: string,
    event: React.MouseEvent | React.KeyboardEvent
  ) {
    close();
    await onOpenStarredPage(url, wantsNewTab(event));
  }

  // Only asked for while the widened search is actually in use, so the common
  // case never touches the bookmarks API.
  useEffect(() => {
    const parsed = parseFavoritesQuery(query);
    if (!isOpen || parsed.scope !== 'all') {
      return;
    }
    let cancelled = false;
    void searchAllBookmarks(parsed.term).then((results) => {
      if (!cancelled) {
        setWidened(results);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, query]);

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
  //
  // Opened straight from the effect. This used to defer a frame, which meant a
  // second state change in the same batch could cancel the frame through the
  // cleanup and the menu never opened at all — the shortcut looked dead while
  // the trigger beside it worked. Nothing here needs the DOM to have painted:
  // placing the cursor is the focus effect's job, and it retries until it lands.
  /* eslint-disable @eslint-react/set-state-in-effect -- opening the menu *is*
     this effect's job: the shortcut arrives as a changed prop, so there is
     nothing to respond to but the change itself. Deferring it to a frame is what
     broke the shortcut in the first place. */
  useEffect(() => {
    if (focusRequest === 0) {
      return;
    }
    measure();
    setIsOpen(true);
    setQuery('');
    setHighlight(0);
    setFocusToken((token) => token + 1);
    // Inlined rather than calling open(), so this depends on nothing that
    // changes every render.
  }, [focusRequest]);
  /* eslint-enable @eslint-react/set-state-in-effect */

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
        void activateRow(target, event);
      }
    }
  }

  return (
    <div className={classes.wrap} ref={wrapRef}>
      <Button
        className={classes.trigger}
        isExpanded={isOpen}
        hasPopup="menu"
        description="Starred Azure DevOps pages"
        onClick={() => {
          if (isOpen) {
            close();
            return;
          }
          // The button opens the same surface the shortcut does. Only when that
          // turns out to be this panel does the menu below open.
          void onRequestFavoritesSearch().then((handledElsewhere) => {
            if (!handledElsewhere) {
              open();
            }
          });
        }}
      >
        <span className={classes.triggerLabel}>
          Starred
          <span className={classes.count}>{pages.length || ''}</span>
        </span>
        <span aria-hidden="true" className={classes.caret}>
          ▾
        </span>
      </Button>

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
              placeholder="Search favorites — . for all bookmarks"
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
              {pages.length + quickTaskPages.length === 0
                ? 'No other favorites to open.'
                : 'Nothing matches that search.'}
            </p>
          ) : (
            visible.map((entry, index) => (
              <Fragment key={rowKey(entry)}>
                {sectionLabelAt(listing, index) !== null && (
                  <div className={classes.divider} role="separator">
                    {sectionLabelAt(listing, index)}
                  </div>
                )}
                <button
                  type="button"
                  role="menuitem"
                  ref={(element) => {
                    itemElementsRef.current[index] = element;
                  }}
                  className={clsx(
                    classes.item,
                    isIndented(listing, index) && classes.itemIndented,
                    index === highlight && classes.itemHighlighted
                  )}
                  title={rowDetail(entry)}
                  // Hover is left to CSS: moving the keyboard highlight with the
                  // cursor means Enter opens whatever the mouse happens to be
                  // resting over rather than what the arrow keys chose. They are
                  // two separate selections and stay separate.
                  onKeyDown={onNavigationKeyDown}
                  onClick={(event) => {
                    void activateRow(entry, event);
                  }}
                >
                  {entry.kind === 'folder' ? (
                    <span aria-hidden="true" className={classes.folderIcon}>
                      📁
                    </span>
                  ) : (
                    <FavoriteIcon url={entry.page.url} />
                  )}
                  <span className={classes.itemText}>
                    {rowLabel(entry)}
                    <span className={classes.itemUrl}>{rowDetail(entry)}</span>
                  </span>
                </button>
              </Fragment>
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

/** The divider label that belongs above this row, if any. */
function sectionLabelAt(
  listing: FavoritesListing,
  index: number
): string | null {
  const section = listing.sections.find(
    (candidate) => candidate.startIndex === index
  );
  return section?.label ?? null;
}

/** Rows of a folder sit in from the edge, which is what makes them read as one. */
function isIndented(listing: FavoritesListing, index: number): boolean {
  return listing.sections.some(
    (section) =>
      section.indent &&
      index >= section.startIndex &&
      index < section.startIndex + section.rows.length
  );
}
