import { isScopeRefusal, PAT_CORE_SCOPE, PAT_SCOPE } from './patApi';

describe('PAT scopes', () => {
  it('prefers a scope that covers the theme setting, and falls back to one that does not', () => {
    expect(PAT_SCOPE).toContain('vso.settings_write');
    expect(PAT_CORE_SCOPE).not.toContain('vso.settings_write');
    // The fallback must still cover what the extension exists to do.
    expect(PAT_CORE_SCOPE).toContain('vso.work_write');
    expect(PAT_CORE_SCOPE).toContain('vso.code');
  });
});

describe('isScopeRefusal', () => {
  it('retries with fewer scopes only when the request was understood and declined', () => {
    expect(isScopeRefusal(400)).toBe(true);
    expect(isScopeRefusal(401)).toBe(true);
    expect(isScopeRefusal(403)).toBe(true);
  });

  it('does not quietly narrow the token over a failure that says nothing about scope', () => {
    expect(isScopeRefusal(500)).toBe(false);
    expect(isScopeRefusal(429)).toBe(false);
    expect(isScopeRefusal(404)).toBe(false);
  });
});
