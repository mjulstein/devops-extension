import { buildAdoThemeSetting, parseAdoThemeSetting } from './theme';

describe('parseAdoThemeSetting', () => {
  it('reads the two theme ids Azure DevOps ships with', () => {
    expect(parseAdoThemeSetting('ms.vss-web.vsts-theme-dark')).toBe('dark');
    expect(parseAdoThemeSetting('ms.vss-web.vsts-theme')).toBe('light');
  });

  it('recognises a dark theme it has not seen before', () => {
    expect(
      parseAdoThemeSetting('ms.vss-web.vsts-theme-dark-high-contrast')
    ).toBe('dark');
  });

  it('returns null for a missing setting rather than assuming light', () => {
    expect(parseAdoThemeSetting(undefined)).toBeNull();
    expect(parseAdoThemeSetting(null)).toBeNull();
    expect(parseAdoThemeSetting(42)).toBeNull();
  });
});

describe('buildAdoThemeSetting', () => {
  it('writes the entry Azure DevOps reads its theme from', () => {
    expect(buildAdoThemeSetting('dark')).toEqual({
      'WebPlatform/Theme': 'ms.vss-web.vsts-theme-dark'
    });
    expect(buildAdoThemeSetting('light')).toEqual({
      'WebPlatform/Theme': 'ms.vss-web.vsts-theme'
    });
  });
});
