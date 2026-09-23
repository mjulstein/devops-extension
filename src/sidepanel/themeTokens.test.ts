import {
  collectThemePalettes,
  pruneOverrides,
  resolvePalette
} from './themeTokens';

describe('collectThemePalettes', () => {
  const rules = [
    {
      selectorText: ':root',
      declarations: [
        ['--color-surface', ' #fff '],
        ['--color-text', '#24292f'],
        ['font-size', '13px']
      ] as [string, string][]
    },
    {
      selectorText: ':root[data-theme="dark"]',
      declarations: [['--color-surface', '#1f1f1f']] as [string, string][]
    },
    {
      selectorText: '.row',
      declarations: [['--color-surface', 'red']] as [string, string][]
    }
  ];

  it('reads each theme from its own rule', () => {
    const palettes = collectThemePalettes(rules);

    expect(palettes.light['color-surface']).toBe('#fff');
    expect(palettes.dark['color-surface']).toBe('#1f1f1f');
  });

  it('ignores ordinary properties and unrelated rules', () => {
    const palettes = collectThemePalettes(rules);

    expect(palettes.light['font-size']).toBeUndefined();
    expect(Object.keys(palettes.light)).toEqual([
      'color-surface',
      'color-text'
    ]);
  });

  it('matches the dark selector whichever quotes the browser reports', () => {
    const single = collectThemePalettes([
      {
        selectorText: ":root[data-theme='dark']",
        declarations: [['--color-text', '#fff']] as [string, string][]
      }
    ]);

    expect(single.dark['color-text']).toBe('#fff');
  });
});

describe('resolvePalette', () => {
  it('lays overrides over the defaults', () => {
    expect(resolvePalette({ a: '#111', b: '#222' }, { b: '#333' })).toEqual({
      a: '#111',
      b: '#333'
    });
  });
});

describe('pruneOverrides', () => {
  const defaults = { 'color-surface': '#fff', 'color-text': '#000' };

  it('drops a value equal to the default, so a later default change is inherited', () => {
    expect(pruneOverrides({ 'color-surface': '#fff' }, defaults)).toEqual({});
  });

  it('ignores whitespace differences when comparing', () => {
    expect(pruneOverrides({ 'color-surface': '  #fff  ' }, defaults)).toEqual(
      {}
    );
  });

  it('drops an emptied field rather than storing an empty colour', () => {
    expect(pruneOverrides({ 'color-text': '   ' }, defaults)).toEqual({});
  });

  it('keeps a real change', () => {
    expect(pruneOverrides({ 'color-text': '#ff0000' }, defaults)).toEqual({
      'color-text': '#ff0000'
    });
  });
});
