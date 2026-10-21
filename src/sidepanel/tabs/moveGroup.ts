// Moving a group among its siblings, worked out before anything is written.
//
// The menu says "up" and "to top"; both ends of the list need a number. Keeping
// that arithmetic here means the one place it can be wrong is also the one
// place it is tested.

import type { GroupMove } from './GroupMoveMenu';

/**
 * The gap a move lands in, for a list reordered by gap index.
 *
 * Gaps are the spaces between items, so a list of three has four of them. An
 * item at index `i` already sits between gaps `i` and `i + 1`, which is why
 * moving down has to clear two.
 */
export function gapForMove(
  where: GroupMove,
  index: number,
  count: number
): number {
  switch (where) {
    case 'top':
      return 0;
    case 'up':
      return Math.max(0, index - 1);
    case 'down':
      return Math.min(count, index + 2);
    case 'bottom':
      return count;
  }
}

/**
 * The same move, as a bookmark to shift and where to put it.
 *
 * Bookmarks are moved by index into their folder, and browsers disagree about
 * whether that index is read before or after the node is taken out — which
 * makes every downward move off by one somewhere. So nothing ever moves down:
 * moving an item down is moving the one below it up, which both readings agree
 * about, and moving to the bottom is an append, which they also agree about.
 *
 * Null when there is nowhere to go.
 */
export function bookmarkMoveFor(
  where: GroupMove,
  index: number,
  siblingIds: string[]
): { id: string; index: number } | null {
  const count = siblingIds.length;
  const id = siblingIds[index];
  if (id === undefined) {
    return null;
  }

  switch (where) {
    case 'top':
      return index === 0 ? null : { id, index: 0 };
    case 'up':
      return index === 0 ? null : { id, index: index - 1 };
    case 'down': {
      const below = siblingIds[index + 1];
      return below === undefined ? null : { id: below, index };
    }
    case 'bottom':
      return index === count - 1 ? null : { id, index: count };
  }
}
