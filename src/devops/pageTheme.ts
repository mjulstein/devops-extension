// Azure DevOps's own colours, read from the page.
//
// The panel's palette was written to match Azure DevOps, but Azure DevOps is
// what it is at any given moment — themes change between releases, and an
// organization can carry a different one. Reading the live values is the only
// way to be sure the two agree, and it is also the honest answer to "reset to
// the Azure DevOps colours": take them from Azure DevOps.

/**
 * Which page variable each of our tokens should follow.
 *
 * Deliberately partial. A token with no sensible counterpart is left alone
 * rather than mapped to something approximate, because a wrong colour is worse
 * than the default one.
 */
export const ADO_TOKEN_SOURCES: Record<string, string[]> = {
  'color-surface': ['--background-color', '--palette-neutral-0'],
  'color-surface-sunken': ['--secondary-background-color'],
  'color-surface-raised': ['--callout-background-color', '--palette-neutral-2'],
  'color-surface-hover': ['--palette-neutral-4'],
  'color-surface-muted': ['--palette-neutral-6'],
  'color-border': ['--palette-neutral-20'],
  'color-border-strong': ['--palette-neutral-30'],
  'color-border-subtle': ['--palette-neutral-8'],
  'color-text': ['--text-primary-color'],
  'color-text-secondary': ['--text-secondary-color'],
  'color-text-muted': ['--text-secondary-color'],
  'color-text-subtle': ['--text-disabled-color'],
  'color-accent': ['--communication-foreground', '--palette-primary-shade-10'],
  'color-accent-strong': ['--communication-foreground'],
  'color-accent-surface': ['--communication-background'],
  'color-success': ['--palette-success-shade-10'],
  'color-warning': ['--palette-warning-shade-10'],
  'color-danger': ['--palette-error-shade-10']
};

/**
 * Reads the page's own values for the tokens above.
 *
 * Runs in the page, so it takes a resolver rather than touching the DOM itself —
 * which is also what lets it be tested.
 */
export function collectAdoThemeColors(
  readVariable: (name: string) => string,
  sources: Record<string, string[]> = ADO_TOKEN_SOURCES
): Record<string, string> {
  const colors: Record<string, string> = {};

  for (const [token, candidates] of Object.entries(sources)) {
    for (const candidate of candidates) {
      const value = readVariable(candidate).trim();
      // A variable Azure DevOps does not define resolves to an empty string,
      // and an empty custom property would blank the panel rather than theme it.
      if (value) {
        colors[token] = value;
        break;
      }
    }
  }

  return colors;
}

/** Reads them from the live document. Called in the content script. */
export function readAdoThemeColorsFromPage(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  return collectAdoThemeColors((name) => {
    const fromRoot = styles.getPropertyValue(name);
    return fromRoot || body.getPropertyValue(name);
  });
}
