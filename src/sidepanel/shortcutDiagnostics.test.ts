import { diagnoseShortcut } from './shortcutDiagnostics';

describe('diagnoseShortcut', () => {
  it('reports the keys the browser actually bound', () => {
    const result = diagnoseShortcut({ shortcut: 'Alt+Shift+K' });

    expect(result.isBound).toBe(true);
    expect(result.text).toContain('Alt+Shift+K');
    expect(result.settingsUrl).toBe('edge://extensions/shortcuts');
  });

  it('calls out an empty binding, which is the silent failure', () => {
    const result = diagnoseShortcut({ shortcut: '' });

    expect(result.isBound).toBe(false);
    expect(result.text).toContain('clashes');
    // The fix is only reachable from the browser's own page, so it has to be shown.
    expect(result.settingsUrl).toBe('edge://extensions/shortcuts');
  });

  it('treats whitespace as unbound rather than as a key name', () => {
    expect(diagnoseShortcut({ shortcut: '   ' }).isBound).toBe(false);
  });

  it('separates a missing command from an unbound one', () => {
    const result = diagnoseShortcut(null);

    expect(result.isBound).toBe(false);
    expect(result.text).toContain('Reload the extension');
    expect(result.settingsUrl).toBeNull();
  });
});
