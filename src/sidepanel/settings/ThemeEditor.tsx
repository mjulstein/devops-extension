import { useMemo, useState } from 'react';
import classes from './ThemeEditor.module.css';
import type { Settings } from '@/types';
import type { AdoTheme } from '@/devops/theme';
import { Button } from '../atoms/Button';
import { readAdoThemeColors } from '../tabMessaging';
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

type SourceState = 'idle' | 'reading';

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
  const [sourceState, setSourceState] = useState<SourceState>('idle');
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);

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

  /**
   * Replaces this theme's overrides with what Azure DevOps is actually using.
   *
   * Read from the page rather than from a stored setting: a theme is a computed
   * style, so the page in front is the only thing that knows. Off Azure DevOps
   * there is nothing to read, and saying so beats overwriting the palette with
   * whatever some other site happens to define.
   */
  async function sourceFromAdo(theme: AdoTheme) {
    setSourceState('reading');
    setSourceMessage(null);
    try {
      const response = await readAdoThemeColors();
      if (!response.ok) {
        setSourceMessage(response.error);
        return;
      }
      const colors = response.result;
      const count = Object.keys(colors).length;
      if (count === 0) {
        setSourceMessage(
          'That page defined none of the colours — open an Azure DevOps page and try again.'
        );
        return;
      }
      onChange({
        ...settings,
        themeOverrides: {
          ...settings.themeOverrides,
          [theme]: pruneOverrides(colors, palettes[theme])
        }
      });
      setSourceMessage(`Took ${count} colours from the Azure DevOps page.`);
    } catch (error) {
      setSourceMessage(
        error instanceof Error
          ? error.message
          : 'Could not read the colours from that page.'
      );
    } finally {
      setSourceState('idle');
    }
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

            <div className={classes.actions}>
              <Button
                size="compact"
                disabled={changedCount === 0}
                description={`Drop every ${theme} colour you changed and follow the built-in palette again`}
                onClick={() => resetTheme(theme)}
              >
                Reset to defaults
              </Button>
              <Button
                size="compact"
                disabled={sourceState === 'reading'}
                description="Take the colours from the Azure DevOps page in front, so the panel matches it exactly"
                onClick={() => void sourceFromAdo(theme)}
              >
                {sourceState === 'reading'
                  ? 'Reading…'
                  : 'Use Azure DevOps colours'}
              </Button>
            </div>
            {sourceMessage && <p className={classes.note}>{sourceMessage}</p>}
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
