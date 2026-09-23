import { isAdoTheme } from './theme';

describe('isAdoTheme', () => {
  it('accepts only the two themes there are', () => {
    expect(isAdoTheme('light')).toBe(true);
    expect(isAdoTheme('dark')).toBe(true);
  });

  it('rejects a stale or absent stored value, so the panel falls back to light', () => {
    expect(isAdoTheme(undefined)).toBe(false);
    expect(isAdoTheme('ms.vss-web.vsts-theme-dark')).toBe(false);
  });
});
