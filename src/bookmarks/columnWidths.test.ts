import {
  COLUMN_LIMITS,
  DEFAULT_COLUMN_WIDTHS,
  loadColumnWidths,
  saveColumnWidths
} from './columnWidths';

describe('column widths', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      }
    });
  });

  it('starts at the sizes the page has always had', () => {
    expect(loadColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('round-trips a saved layout', () => {
    saveColumnWidths({ tree: 420, issues: 700 });
    expect(loadColumnWidths()).toEqual({ tree: 420, issues: 700 });
  });

  it('clamps a stored width that would hide a column', () => {
    store.set(
      'bookmarkManagerColumnWidths',
      JSON.stringify({ tree: 1, issues: 9e9 })
    );
    expect(loadColumnWidths()).toEqual({
      tree: COLUMN_LIMITS.tree.min,
      issues: COLUMN_LIMITS.issues.max
    });
  });

  it('falls back when the stored value is not a layout', () => {
    store.set('bookmarkManagerColumnWidths', 'not json');
    expect(loadColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it('survives storage being unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    });
    expect(loadColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(() => {
      saveColumnWidths(DEFAULT_COLUMN_WIDTHS);
    }).not.toThrow();
  });
});
