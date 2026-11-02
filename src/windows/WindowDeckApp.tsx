import { useState } from 'react';
import { WindowDeck } from './WindowDeck';
import { useWindowDeck } from './useWindowDeck';
import { orderWindows, type DeckWindow } from './windowDeck';
import classes from './WindowDeckApp.module.css';

/**
 * The window deck page.
 *
 * It is meant to sit down the side of a screen and be left there: one
 * instance, raised rather than reopened, and closed only when somebody closes
 * it. That is why it holds no settings and writes nothing down — it is a view
 * of what is open right now, and the moment it is closed there is nothing
 * about it worth having kept.
 */
export function WindowDeckApp() {
  const { windows } = useWindowDeck();
  const [order, setOrder] = useState<number[]>([]);
  const [pinned, setPinned] = useState<number[]>([]);

  const shown = orderWindows(windows, order, pinned);

  return (
    <div className={classes.wrap}>
      <header className={classes.header}>
        <span className={classes.count}>
          {shown.length === 1 ? '1 window' : `${String(shown.length)} windows`}
        </span>
      </header>

      <WindowDeck
        windows={shown}
        pinned={pinned}
        onOrderChange={(next) => {
          // The pins keep their own order, so a move among the pinned rows is
          // a move, not a silent no-op against a list that is drawn on top.
          setOrder(next);
          setPinned((current) => next.filter((id) => current.includes(id)));
        }}
        onTogglePinned={(id) => {
          setPinned((current) =>
            current.includes(id)
              ? current.filter((entry) => entry !== id)
              : [...current, id]
          );
          setOrder((current) =>
            current.includes(id) ? current : [...shown.map((w) => w.id)]
          );
        }}
        onSwitchTo={(id) => {
          void chrome.windows?.update(id, {
            focused: true,
            drawAttention: true
          });
        }}
        onDetachFront={(window: DeckWindow) => {
          // The deck's own answer to a window that has grown into several
          // things at once: take the one in front out, leave the rest where
          // they are. The new window takes focus, because asking for it is
          // asking to work in it.
          if (window.frontTabId !== null) {
            void chrome.windows?.create({
              tabId: window.frontTabId,
              focused: true
            });
          }
        }}
        onClose={(window: DeckWindow) => {
          // A window can hold a day's work. The tabs list closes a tab without
          // asking because one tab is one thing; a window is however many you
          // have not looked at lately.
          if (
            window.single ||
            globalThis.confirm(
              `Close ${window.title} and ${String(window.tabs.length - 1)} other tab${window.tabs.length === 2 ? '' : 's'}?`
            )
          ) {
            void chrome.windows?.remove(window.id);
          }
        }}
      />
    </div>
  );
}
