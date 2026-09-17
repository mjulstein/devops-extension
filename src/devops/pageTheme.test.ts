import { ADO_TOKEN_SOURCES, collectAdoThemeColors } from './pageTheme';

describe('collectAdoThemeColors', () => {
  it('takes each token from the page variable it follows', () => {
    const colors = collectAdoThemeColors(
      (name) =>
        ({
          '--background-color': '#1f1f1f',
          '--text-primary-color': '#f5f5f5'
        })[name] ?? '',
      {
        'color-surface': ['--background-color'],
        'color-text': ['--text-primary-color']
      }
    );

    expect(colors).toEqual({
      'color-surface': '#1f1f1f',
      'color-text': '#f5f5f5'
    });
  });

  it('falls through to the next candidate when the first is not defined', () => {
    const colors = collectAdoThemeColors(
      (name) => (name === '--palette-neutral-0' ? '#fff' : ''),
      {
        'color-surface': ['--background-color', '--palette-neutral-0']
      }
    );

    expect(colors).toEqual({ 'color-surface': '#fff' });
  });

  it('omits a token the page defines nothing for, rather than storing an empty colour', () => {
    const colors = collectAdoThemeColors(() => '   ', ADO_TOKEN_SOURCES);

    expect(colors).toEqual({});
  });

  it('maps only tokens with a real counterpart, leaving the rest to the defaults', () => {
    // A guard on the table itself: every entry must name at least one source.
    for (const [token, sources] of Object.entries(ADO_TOKEN_SOURCES)) {
      expect(sources.length, token).toBeGreaterThan(0);
    }
  });
});
