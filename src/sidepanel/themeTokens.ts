// The colour tokens, read from the stylesheet that defines them.
//
// `src/theme.css` stays the single source of truth for what a theme looks like.
// Restating those values in TypeScript would be a second copy free to drift, so
// the settings editor reads the real rules out of the stylesheet instead, and
// only what the user actually changes is stored.

import type { ThemeOverrides } from '@/types';
import type { AdoTheme } from '@/devops/theme';

export type ThemePalette = Record<string, string>;

export interface ThemePalettes {
  light: ThemePalette;
  dark: ThemePalette;
}

/** Selectors `src/theme.css` declares each theme's tokens under. */
const LIGHT_SELECTOR = ':root';
const DARK_SELECTOR = ":root[data-theme='dark']";

const EMPTY_PALETTES: ThemePalettes = { light: {}, dark: {} };

/**
 * Pulls both palettes out of already-parsed style rules.
 *
 * Taken as plain shapes rather than live CSSOM objects so this can be exercised
 * without a browser; the caller does the walking.
 */
export function collectThemePalettes(
  rules: { selectorText?: string; declarations: [string, string][] }[]
): ThemePalettes {
  const palettes: ThemePalettes = { light: {}, dark: {} };

  for (const rule of rules) {
    const selector = normalizeSelector(rule.selectorText);
    const target =
      selector === LIGHT_SELECTOR
        ? palettes.light
        : selector === DARK_SELECTOR
          ? palettes.dark
          : null;
    if (target === null) {
      continue;
    }
    for (const [property, value] of rule.declarations) {
      if (property.startsWith('--')) {
        target[property.slice(2)] = value.trim();
      }
    }
  }

  return palettes;
}

/**
 * Quote style is not stable across browsers, and neither is incidental
 * whitespace, so both are normalised before matching.
 */
function normalizeSelector(selectorText: string | undefined): string {
  return (selectorText ?? '').replace(/"/g, "'").replace(/\s+/g, '');
}

/** Reads the palettes from the document's own stylesheets. */
export function readThemePalettes(): ThemePalettes {
  if (typeof document === 'undefined') {
    return EMPTY_PALETTES;
  }

  const rules: { selectorText?: string; declarations: [string, string][] }[] =
    [];

  for (const sheet of Array.from(document.styleSheets)) {
    let sheetRules: CSSRuleList;
    try {
      sheetRules = sheet.cssRules;
    } catch {
      // A cross-origin stylesheet cannot be read. Ours is same-origin, so this
      // only skips something that was never going to hold our tokens.
      continue;
    }

    for (const rule of Array.from(sheetRules)) {
      if (!(rule instanceof CSSStyleRule)) {
        continue;
      }
      const declarations: [string, string][] = [];
      for (const property of Array.from(rule.style)) {
        declarations.push([property, rule.style.getPropertyValue(property)]);
      }
      rules.push({ selectorText: rule.selectorText, declarations });
    }
  }

  return collectThemePalettes(rules);
}

/** Defaults with the user's overrides laid on top. */
export function resolvePalette(
  defaults: ThemePalette,
  overrides: Record<string, string>
): ThemePalette {
  return { ...defaults, ...overrides };
}

/**
 * Applies overrides to the document.
 *
 * Every token is cleared first, so a token removed from the overrides returns to
 * its stylesheet value instead of being stuck at the last one set inline.
 */
export function applyThemeOverrides(
  theme: AdoTheme,
  overrides: ThemeOverrides,
  palettes: ThemePalettes = readThemePalettes()
): void {
  const root = document.documentElement;
  for (const token of Object.keys(palettes[theme])) {
    root.style.removeProperty(`--${token}`);
  }
  for (const [token, value] of Object.entries(overrides[theme])) {
    root.style.setProperty(`--${token}`, value);
  }
}

/**
 * Drops overrides equal to the default, so the stored set stays a record of
 * deliberate changes and a later change to a default is still inherited.
 */
export function pruneOverrides(
  overrides: Record<string, string>,
  defaults: ThemePalette
): Record<string, string> {
  const pruned: Record<string, string> = {};
  for (const [token, value] of Object.entries(overrides)) {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed !== defaults[token]?.trim()) {
      pruned[token] = trimmed;
    }
  }
  return pruned;
}
