import { describeShortcutRun, diagnoseShortcut } from './shortcutDiagnostics';

describe('diagnoseShortcut', () => {
  it('reports the keys the browser actually bound', () => {
    const result = diagnoseShortcut({ shortcut: 'Ctrl+Period' });

    expect(result.isBound).toBe(true);
    expect(result.text).toContain('Ctrl+Period');
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

describe('describeShortcutRun', () => {
  const at = 1_000_000;

  it('separates never-pressed from pressed-and-failed', () => {
    expect(describeShortcutRun(null)).toContain('Never pressed');
  });

  it('names the browser refusing to open the panel', () => {
    const text = describeShortcutRun(
      { at, opened: false, delivered: false, error: null },
      at + 5000
    );

    expect(text).toContain('5s ago');
    expect(text).toContain('refused to open');
  });

  it('separates an opened panel that never took the message', () => {
    const text = describeShortcutRun(
      { at, opened: true, delivered: false, error: null },
      at + 120_000
    );

    expect(text).toContain('2m ago');
    expect(text).toContain('did not take the focus message');
  });

  it('reports a thrown error verbatim, since that is the actual diagnosis', () => {
    const text = describeShortcutRun(
      { at, opened: false, delivered: false, error: 'user gesture required' },
      at + 1000
    );

    expect(text).toContain('user gesture required');
  });

  it('says so plainly when the whole chain worked', () => {
    expect(
      describeShortcutRun(
        { at, opened: true, delivered: true, error: null },
        at
      )
    ).toContain('worked');
  });
});

describe('describeShortcutRun, palette surface', () => {
  it('names the in-page palette, so a press that never touched the panel is not read as a failure', () => {
    const text = describeShortcutRun(
      {
        at: 1_000_000,
        opened: true,
        delivered: true,
        error: null,
        surface: 'overlay'
      },
      1_000_000
    );

    expect(text).toContain('palette over the page');
  });
});
