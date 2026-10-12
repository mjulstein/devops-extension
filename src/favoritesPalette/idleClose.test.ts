import { shouldCloseOnFocusChange, shouldIdleClose } from './idleClose';

describe('shouldIdleClose', () => {
  it('never runs while the window has focus', () => {
    // The reported bug: typing into a focused palette closed it mid-sentence.
    expect(shouldIdleClose({ pinned: false, focused: true })).toBe(false);
  });

  it('runs for a palette left behind with focus elsewhere', () => {
    expect(shouldIdleClose({ pinned: false, focused: false })).toBe(true);
  });

  it('never runs when pinned, focused or not', () => {
    expect(shouldIdleClose({ pinned: true, focused: true })).toBe(false);
    expect(shouldIdleClose({ pinned: true, focused: false })).toBe(false);
  });
});

describe('shouldCloseOnFocusChange', () => {
  const base = {
    pinned: false,
    settling: false,
    focusedWindowId: 2,
    paletteWindowId: 1
  };

  it('closes when another browser window takes focus', () => {
    expect(shouldCloseOnFocusChange(base)).toBe(true);
  });

  it('does not close when the palette is the window taking focus', () => {
    expect(shouldCloseOnFocusChange({ ...base, focusedWindowId: 1 })).toBe(
      false
    );
  });

  it('does not close while focus is still settling after opening', () => {
    // The reported bug: the window the shortcut was pressed in takes focus back
    // as the popup appears, and the palette shut the instant it opened.
    expect(shouldCloseOnFocusChange({ ...base, settling: true })).toBe(false);
  });

  it('does not close when pinned', () => {
    expect(shouldCloseOnFocusChange({ ...base, pinned: true })).toBe(false);
  });
});
