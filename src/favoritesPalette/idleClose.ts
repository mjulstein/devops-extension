// When the palette window may close itself.
//
// It is one rule, kept out of the page so it can be stated once and tested:
// a window you are typing in never closes under you.

export interface IdleCloseState {
  /** The pin in the header, which switches the whole thing off. */
  pinned: boolean;
  /** Whether the palette window currently holds keyboard focus. */
  focused: boolean;
}

/**
 * Whether the idle timer should be running.
 *
 * Only while the window does *not* have focus. Focus is the difference between
 * a window being used and a window being forgotten, and a timer that runs
 * through a focused window is a window that vanishes mid-sentence — which is
 * exactly what it did, because the palette stops key events at its own host and
 * the activity listener on `window` never saw a keystroke.
 *
 * With focus, the timer only ever matters for a palette left behind: another
 * browser window taking focus closes it outright, and this catches the case the
 * worker deliberately ignores, where the whole browser went to the background.
 */
export function shouldIdleClose({ pinned, focused }: IdleCloseState): boolean {
  return !pinned && !focused;
}
