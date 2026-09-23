import { buildPaletteView, resolvePaletteKey } from './paletteModel';
import { rowLabel } from '@/sidepanel/favoritesListing';
import type { StarredPage } from '@/sidepanel/starredPages';

function page(label: string, url: string): StarredPage {
  return { label, url, starredAt: 1 };
}

const PAGES = [
  page(
    'Frontend board',
    'https://dev.azure.test/org/proj/_boards/board/t/Frontend'
  ),
  page(
    'Backend board',
    'https://dev.azure.test/org/proj/_boards/board/t/Backend'
  ),
  page('Dashboards', 'https://dev.azure.test/org/proj/_dashboards')
];

describe('buildPaletteView', () => {
  it('ranks rows for the query', () => {
    const view = buildPaletteView(PAGES, 'backend', 0);

    expect(view.rows.map(rowLabel)).toEqual(['Backend board']);
  });

  it('clamps a highlight left over from a longer result set', () => {
    const view = buildPaletteView(PAGES, 'backend', 2);

    expect(view.highlight).toBe(0);
  });

  it('keeps the highlight at zero when nothing matches', () => {
    const view = buildPaletteView(PAGES, 'nothing here', 3);

    expect(view.rows).toEqual([]);
    expect(view.highlight).toBe(0);
  });
});

describe('resolvePaletteKey', () => {
  const view = buildPaletteView(PAGES, '', 0);

  it('closes on Escape', () => {
    expect(resolvePaletteKey('Escape', view)).toEqual({ kind: 'close' });
  });

  it('wraps around both ends', () => {
    expect(resolvePaletteKey('ArrowUp', view)).toEqual({
      kind: 'move',
      highlight: 2
    });
    expect(resolvePaletteKey('ArrowDown', { ...view, highlight: 2 })).toEqual({
      kind: 'move',
      highlight: 0
    });
  });

  it('opens the highlighted row on Enter', () => {
    expect(resolvePaletteKey('Enter', { ...view, highlight: 1 })).toEqual({
      kind: 'open',
      index: 1
    });
  });

  it('does nothing on Enter with no matches, rather than opening something arbitrary', () => {
    const empty = buildPaletteView(PAGES, 'no match', 0);

    expect(resolvePaletteKey('Enter', empty)).toEqual({ kind: 'ignore' });
    expect(resolvePaletteKey('ArrowDown', empty)).toEqual({ kind: 'ignore' });
  });

  it('ignores ordinary typing, which belongs to the search field', () => {
    expect(resolvePaletteKey('a', view)).toEqual({ kind: 'ignore' });
  });
});
