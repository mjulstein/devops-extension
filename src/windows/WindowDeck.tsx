import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/sidepanel/atoms/Button';
import { GroupMoveMenu, type GroupMove } from '@/sidepanel/tabs/GroupMoveMenu';
import { gapForMove } from '@/sidepanel/tabs/moveGroup';
import { describeWindow, moveIdTo, type DeckWindow } from './windowDeck';
import classes from './WindowDeck.module.css';

interface WindowDeckProps {
  windows: DeckWindow[];
  /** Which windows are held at the top. The order is already applied. */
  pinned: number[];
  onOrderChange: (order: number[]) => void;
  onTogglePinned: (id: number) => void;
  onSwitchTo: (id: number) => void;
  onClose: (window: DeckWindow) => void;
}

/**
 * The open windows, to switch between.
 *
 * A deck rather than a tree: every row is a place to go, and the question it
 * answers is "where do I go now" rather than "what have I got open". The rows
 * borrow the tabs list's shape because the gestures should not have to be
 * learned twice — the name switches, the ✕ closes, and the icon holds the move
 * menu.
 *
 * The order and the pins are the page's own state and are never written down.
 * A window id does not outlive its window, so an order remembered across a
 * restart would be an order about windows that no longer exist.
 */
export function WindowDeck({
  windows,
  pinned,
  onOrderChange,
  onTogglePinned,
  onSwitchTo,
  onClose
}: WindowDeckProps) {
  const [menuId, setMenuId] = useState<number | null>(null);

  if (windows.length === 0) {
    return <p className={classes.empty}>No other windows are open.</p>;
  }

  return (
    <div className={classes.deck}>
      {windows.map((window, index) => {
        const isPinned = pinned.includes(window.id);

        return (
          <div
            key={window.id}
            className={clsx(
              classes.row,
              window.focused && classes.focused,
              isPinned && classes.pinned
            )}
          >
            <Button
              size="compact"
              variant="quiet"
              icon="✕"
              description={`Close ${describeWindow(window)}`}
              onClick={() => {
                onClose(window);
              }}
            />
            {/* The icon is the one part of a row with no job of its own, so it
                is where the move menu lives — the same place as in the tabs
                list, for the same reason. */}
            {window.favIconUrl === null ? (
              <span
                className={classes.icon}
                title={`Right-click to move ${window.title}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenuId(window.id);
                }}
              />
            ) : (
              <img
                className={classes.icon}
                src={window.favIconUrl}
                alt=""
                title={`Right-click to move ${window.title}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenuId(window.id);
                }}
              />
            )}
            <button
              type="button"
              className={classes.name}
              title={window.tabs.map((tab) => tab.title).join('\n')}
              onClick={() => {
                onSwitchTo(window.id);
              }}
            >
              <span className={classes.title}>{window.title}</span>
              <span className={classes.meta}>
                {window.single
                  ? 'one tab'
                  : `${String(window.tabs.length)} tabs`}
                {window.incognito ? ' · private' : ''}
                {window.focused ? ' · here' : ''}
              </span>
            </button>
            <Button
              size="compact"
              variant="quiet"
              icon={isPinned ? '📌' : '📍'}
              description={
                isPinned
                  ? `Let ${window.title} move with the rest`
                  : `Hold ${window.title} at the top`
              }
              onClick={() => {
                onTogglePinned(window.id);
              }}
            />
            {menuId === window.id && (
              <GroupMoveMenu
                label={window.title}
                index={index}
                count={windows.length}
                onMove={(where: GroupMove) => {
                  onOrderChange(
                    moveIdTo(
                      windows.map((entry) => entry.id),
                      window.id,
                      gapForMove(where, index, windows.length)
                    )
                  );
                }}
                onClose={() => {
                  setMenuId(null);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
