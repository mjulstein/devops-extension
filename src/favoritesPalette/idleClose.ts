// When the palette window may close itself.
//
// Two rules, kept out of the page and the worker so they can be stated once and
// tested. Both come down to the same thing: a window you are using never closes
// under you.

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

export interface FocusCloseState {
  pinned: boolean;
  /** True while the palette has just opened and focus has yet to settle. */
  settling: boolean;
  /** The window that has just taken focus. */
  focusedWindowId: number;
  /** The palette's own window. */
  paletteWindowId: number;
}

/**
 * Whether a window taking focus should close the palette.
 *
 * Focus moving to another browser window is the user turning to something else,
 * and closing then is the point. Two cases are not that: the palette taking its
 * own focus, and any focus change in the moment after it opens — a popup does
 * not take focus cleanly, and the window the shortcut was pressed in can hold it
 * or take it back while the new one is being put on screen. Read literally, that
 * shut the palette the instant it appeared.
 */
export function shouldCloseOnFocusChange({
  pinned,
  settling,
  focusedWindowId,
  paletteWindowId
}: FocusCloseState): boolean {
  if (pinned || settling) {
    return false;
  }
  return focusedWindowId !== paletteWindowId;
}
