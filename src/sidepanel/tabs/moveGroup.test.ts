import { bookmarkMoveFor, gapForMove } from './moveGroup';

describe('gapForMove', () => {
  it('sends an item to either end', () => {
    expect(gapForMove('top', 2, 4)).toBe(0);
    expect(gapForMove('bottom', 1, 4)).toBe(4);
  });

  it('clears two gaps going down, one going up', () => {
    // An item already sits between the gaps on each side of it.
    expect(gapForMove('up', 2, 4)).toBe(1);
    expect(gapForMove('down', 1, 4)).toBe(3);
  });

  it('stays inside the list at the ends', () => {
    expect(gapForMove('up', 0, 4)).toBe(0);
    expect(gapForMove('down', 3, 4)).toBe(4);
  });
});

describe('bookmarkMoveFor', () => {
  const ids = ['a', 'b', 'c'];

  it('moves the node itself upward', () => {
    expect(bookmarkMoveFor('up', 2, ids)).toEqual({ id: 'c', index: 1 });
    expect(bookmarkMoveFor('top', 2, ids)).toEqual({ id: 'c', index: 0 });
  });

  it('moves down by lifting the one below instead', () => {
    // Browsers disagree about whether a move index is read before or after the
    // node is taken out, which makes every downward move off by one somewhere.
    expect(bookmarkMoveFor('down', 0, ids)).toEqual({ id: 'b', index: 0 });
  });

  it('appends to reach the bottom', () => {
    expect(bookmarkMoveFor('bottom', 0, ids)).toEqual({ id: 'a', index: 3 });
  });

  it('is nothing when there is nowhere to go', () => {
    expect(bookmarkMoveFor('up', 0, ids)).toBeNull();
    expect(bookmarkMoveFor('top', 0, ids)).toBeNull();
    expect(bookmarkMoveFor('down', 2, ids)).toBeNull();
    expect(bookmarkMoveFor('bottom', 2, ids)).toBeNull();
    expect(bookmarkMoveFor('up', 9, ids)).toBeNull();
  });
});
