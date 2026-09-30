import { shouldIdleClose } from './idleClose';

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
