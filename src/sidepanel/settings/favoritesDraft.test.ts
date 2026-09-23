import {
  commitDraft,
  createDraft,
  draftPages,
  editRow,
  isDraftDirty,
  moveRow,
  removeRow
} from './favoritesDraft';
import type { StarredPage } from '../starredPages';

function page(url: string, label: string): StarredPage {
  return { url, label, starredAt: 1 };
}

const base = [
  page('https://x.invalid/a', 'Alpha'),
  page('https://x.invalid/b', 'Beta')
];

describe('createDraft', () => {
  it('gives every row a distinct key', () => {
    const rows = createDraft(base);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it('keys are stable across edits, so a row is not remounted mid-edit', () => {
    const rows = createDraft(base);
    const edited = editRow(rows, rows[0].key, { url: 'https://x.invalid/zz' });
    expect(edited[0]?.key).toBe(rows[0]?.key);
  });
});

describe('editRow', () => {
  // The reported bug: a trailing space vanished as fast as it was typed.
  it('keeps a trailing space exactly as typed', () => {
    const rows = createDraft([page('https://x.invalid/a', 'Alpha')]);
    const edited = editRow(rows, rows[0].key, { label: 'Alpha ' });
    expect(draftPages(edited)[0]?.label).toBe('Alpha ');
  });

  it('keeps interior double spaces while typing', () => {
    const rows = createDraft([page('https://x.invalid/a', 'A')]);
    const edited = editRow(rows, rows[0].key, { label: 'A  B' });
    expect(draftPages(edited)[0]?.label).toBe('A  B');
  });

  it('leaves an unusable address alone while typing', () => {
    const rows = createDraft([page('https://x.invalid/a', 'A')]);
    const edited = editRow(rows, rows[0].key, { url: 'https://' });
    expect(draftPages(edited)[0]?.url).toBe('https://');
  });

  it('touches only the addressed row', () => {
    const rows = createDraft(base);
    const edited = editRow(rows, rows[1].key, { label: 'Changed' });
    expect(draftPages(edited).map((p) => p.label)).toEqual([
      'Alpha',
      'Changed'
    ]);
  });
});

describe('moveRow and removeRow', () => {
  it('moves a row down', () => {
    const rows = createDraft(base);
    expect(draftPages(moveRow(rows, 0, 1)).map((p) => p.label)).toEqual([
      'Beta',
      'Alpha'
    ]);
  });

  it('is a no-op at the edges', () => {
    const rows = createDraft(base);
    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(moveRow(rows, 1, 1)).toBe(rows);
  });

  it('removes by key, not by position', () => {
    const rows = createDraft(base);
    expect(
      draftPages(removeRow(rows, rows[0].key)).map((p) => p.label)
    ).toEqual(['Beta']);
  });
});

describe('isDraftDirty', () => {
  it('is false for an untouched draft', () => {
    expect(isDraftDirty(createDraft(base), base)).toBe(false);
  });

  it('is true after an edit', () => {
    const rows = createDraft(base);
    expect(isDraftDirty(editRow(rows, rows[0].key, { label: 'x' }), base)).toBe(
      true
    );
  });

  // Even a lone trailing space counts, or Save would be disabled for it.
  it('is true for a trailing-space-only change', () => {
    const rows = createDraft(base);
    expect(
      isDraftDirty(editRow(rows, rows[0].key, { label: 'Alpha ' }), base)
    ).toBe(true);
  });

  it('is true after a reorder', () => {
    expect(isDraftDirty(moveRow(createDraft(base), 0, 1), base)).toBe(true);
  });
});

describe('commitDraft', () => {
  it('trims only at commit', () => {
    const rows = editRow(
      createDraft([page('https://x.invalid/a', 'A')]),
      createDraft([page('https://x.invalid/a', 'A')])[0].key,
      {}
    );
    // Edit through a fresh draft so the key matches.
    const draft = createDraft([page('https://x.invalid/a', '  Spaced  ')]);
    expect(commitDraft(draft)[0]?.label).toBe('Spaced');
    expect(rows).toHaveLength(1);
  });

  it('normalises the address and drops the hash', () => {
    expect(
      commitDraft(createDraft([page('https://x.invalid/a/?q=1#f', 'A')]))[0]
        ?.url
    ).toBe('https://x.invalid/a?q=1');
  });

  it('drops a row whose address was left unusable', () => {
    expect(commitDraft(createDraft([page('nonsense', 'A')]))).toEqual([]);
  });
});
