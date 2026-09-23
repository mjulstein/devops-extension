import {
  buildAdoThemeSetting,
  parseAdoThemeSetting,
  scopeCoversTheme
} from './theme';

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

describe('scopeCoversTheme', () => {
  it('accepts a scope that reaches the settings API', () => {
    expect(scopeCoversTheme('vso.work_write vso.code vso.settings_write')).toBe(
      true
    );
  });

  it('rejects the fallback scope an organization policy can leave us with', () => {
    expect(scopeCoversTheme('vso.work_write vso.code')).toBe(false);
  });

  it('rejects a record from before scopes were tracked', () => {
    expect(scopeCoversTheme(undefined)).toBe(false);
  });
});
