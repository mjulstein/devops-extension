import { useMemo } from 'react';
import classes from './ThemeEditor.module.css';
import type { Settings } from '@/types';
import type { AdoTheme } from '@/devops/theme';
import {
  pruneOverrides,
  readThemePalettes,
  resolvePalette
} from '../themeTokens';

interface ThemeEditorProps {
  settings: Settings;
  /** The theme in force, so the editor opens on the one being looked at. */
  activeTheme: AdoTheme;
  onChange: (nextSettings: Settings) => void;
}

/**
 * Edits the colour tokens for both themes.
 *
 * Defaults come from `src/theme.css` rather than from a list restated here, so
 * there is no second copy to drift. Only changed tokens are stored: a value
 * equal to its default is dropped, which keeps a later change to a default from
 * being silently frozen out by a stored copy of the old one.
 */
export function ThemeEditor({
  settings,
  activeTheme,
  onChange
}: ThemeEditorProps) {
  const palettes = useMemo(() => readThemePalettes(), []);

  function setToken(theme: AdoTheme, token: string, value: string) {
    const next = pruneOverrides(
      { ...settings.themeOverrides[theme], [token]: value },
      palettes[theme]
    );
    onChange({
      ...settings,
      themeOverrides: { ...settings.themeOverrides, [theme]: next }
    });
  }

  function resetTheme(theme: AdoTheme) {
    onChange({
      ...settings,
      themeOverrides: { ...settings.themeOverrides, [theme]: {} }
    });
  }

  const tokens = Object.keys(palettes[activeTheme]);
  if (tokens.length === 0) {
    return (
      <p className={classes.note}>
        The theme stylesheet could not be read, so there is nothing to edit
        here.
      </p>
    );
  }

  return (
    <>
      {(['light', 'dark'] as const).map((theme) => {
        const overrides = settings.themeOverrides[theme];
        const resolved = resolvePalette(palettes[theme], overrides);
        const changedCount = Object.keys(overrides).length;

        return (
          <details key={theme} open={theme === activeTheme}>
            <summary className={classes.summary}>
              {theme === 'light' ? 'Light' : 'Dark'} colours
              {changedCount > 0 ? ` — ${changedCount} changed` : ''}
            </summary>

            <div className={classes.rows}>
              {Object.keys(palettes[theme]).map((token) => (
                <label key={token} className={classes.row}>
                  <input
                    className={classes.swatch}
                    type="color"
                    value={toColorInputValue(resolved[token])}
                    onChange={(event) =>
                      setToken(theme, token, event.target.value)
                    }
                  />
                  <span className={classes.name}>{token}</span>
                  {/* The text field takes any CSS colour, which the swatch
                      cannot — rgb() with alpha among them. */}
                  <input
                    className={classes.value}
                    type="text"
                    value={resolved[token] ?? ''}
                    aria-label={token}
                    onChange={(event) =>
                      setToken(theme, token, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              className={classes.reset}
              disabled={changedCount === 0}
              onClick={() => resetTheme(theme)}
            >
              Reset {theme} to defaults
            </button>
          </details>
        );
      })}
    </>
  );
}

/**
 * A colour input only accepts `#rrggbb`. Anything else — a named colour, an
 * rgb() with alpha — shows as black in the swatch while the text field beside it
 * keeps the real value, which stays editable.
 */
function toColorInputValue(value: string | undefined): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((value ?? '').trim());
  if (!match) {
    return '#000000';
  }
  const hex = match[1];
  return hex.length === 3
    ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    : `#${hex}`;
}
