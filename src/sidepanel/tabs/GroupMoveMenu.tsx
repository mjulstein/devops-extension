import { useEffect, useRef } from 'react';
import classes from './TabGroupList.module.css';

/** Where a group is being sent, in the words of the menu that sends it. */
export type GroupMove = 'top' | 'up' | 'down' | 'bottom';

interface GroupMoveMenuProps {
  label: string;
  /** This group's place among its siblings, and how many there are. */
  index: number;
  count: number;
  onMove: (where: GroupMove) => void;
  onClose: () => void;
}

/**
 * Moving a group without dragging it.
 *
 * Dragging is the gesture people reach for and it is also the one that goes
 * wrong: a drag that loses its state part-way leaves the list exactly as it
 * was, which is indistinguishable from a drop that landed where it started.
 * Four buttons cannot lose their state. They are the way to organise the list
 * and the drag is the shortcut, not the other way round.
 *
 * It opens on a right-click of the group's icon, which is the one part of the
 * heading that does nothing else.
 */
export function GroupMoveMenu({
  label,
  index,
  count,
  onMove,
  onClose
}: GroupMoveMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
  }, []);

  useEffect(() => {
    // Anywhere else, and it is gone: a menu left open over a list that keeps
    // redrawing itself is a menu pointing at whatever has moved under it.
    const dismiss = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const items: { where: GroupMove; text: string; enabled: boolean }[] = [
    { where: 'top', text: 'Move to top', enabled: index > 0 },
    { where: 'up', text: 'Move up', enabled: index > 0 },
    { where: 'down', text: 'Move down', enabled: index < count - 1 },
    { where: 'bottom', text: 'Move to bottom', enabled: index < count - 1 }
  ];

  return (
    <div
      ref={ref}
      className={classes.menu}
      role="menu"
      aria-label={`Move ${label}`}
    >
      {items.map((item) => (
        <button
          key={item.where}
          type="button"
          role="menuitem"
          className={classes.menuItem}
          disabled={!item.enabled}
          onClick={() => {
            onMove(item.where);
            onClose();
          }}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}
