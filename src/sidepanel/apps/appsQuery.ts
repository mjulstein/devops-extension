// Reading an app search, and choosing which environment a row points at.
//
// One row per app, however many environments it has: a list with five rows for
// one app buries the four other apps you also have. The environment is chosen
// on the row instead — Enter takes the first, Tab steps to the next, and typing
// a second word picks one by name.
//
// Nothing here knows any environment names. They are whatever the bookmarks in
// the app's folder are titled, in whatever order they sit in, which is the
// order the user put them in.

import {
  deriveEnvUrl,
  envToken,
  type AppEntry,
  type AppEnvironment
} from './appDns';

export interface AppQuery {
  /** What should match the app's name. */
  appTerm: string;
  /** What should match an environment, or null when nothing was typed. */
  envTerm: string | null;
}

/**
 * Splits a search into an app and an environment.
 *
 * The whole string is tried as an app name first, so an app whose name contains
 * a space is still reachable and a half-typed name is not read as an app plus a
 * one-letter environment. Only when that matches nothing is the last word taken
 * as the environment.
 */
export function parseAppQuery(term: string, apps: AppEntry[]): AppQuery {
  const whole = term.trim();
  if (whole === '') {
    return { appTerm: '', envTerm: null };
  }

  if (matchApps(apps, whole).length > 0) {
    return { appTerm: whole, envTerm: null };
  }

  const cut = whole.lastIndexOf(' ');
  if (cut < 0) {
    return { appTerm: whole, envTerm: null };
  }
  return {
    appTerm: whole.slice(0, cut).trim(),
    envTerm: whole.slice(cut + 1).trim()
  };
}

function rank(name: string, needle: string): number | null {
  const haystack = name.toLowerCase();
  if (needle === '') {
    return 2;
  }
  if (haystack.startsWith(needle)) {
    return 0;
  }
  if (haystack.includes(needle)) {
    return 1;
  }
  return null;
}

/** Apps matching a term, best first, keeping the folder's order for ties. */
export function matchApps(apps: AppEntry[], term: string): AppEntry[] {
  const needle = term.trim().toLowerCase();
  const scored: { app: AppEntry; rank: number; index: number }[] = [];

  apps.forEach((app, index) => {
    const score = rank(app.name, needle);
    if (score !== null) {
      scored.push({ app, rank: score, index });
    }
  });

  return scored
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.app);
}

/**
 * Which environment a typed term names, as an index into the app's own order.
 *
 * -1 when nothing matches, which is not a failure: it is how an environment
 * that exists but has never been added here gets a suggested address.
 */
export function matchEnvironmentIndex(app: AppEntry, term: string): number {
  const needle = envToken(term);
  if (needle === '') {
    return -1;
  }
  const exact = app.environments.findIndex(
    (environment) => envToken(environment.name) === needle
  );
  if (exact >= 0) {
    return exact;
  }
  return app.environments.findIndex((environment) =>
    envToken(environment.name).startsWith(needle)
  );
}

export interface AppTarget {
  app: AppEntry;
  environment: AppEnvironment;
  /** Where it sits in the app's own order; -1 for a suggested address. */
  index: number;
  /**
   * True when this address was worked out from the app's pattern rather than
   * stored. Worth saying on the row: it is a good guess, not a fact.
   */
  isDerived: boolean;
}

/**
 * The environment a row currently points at.
 *
 * `step` is how many times Tab has been pressed on this row. It wraps, so Tab
 * eventually comes back to where it started rather than stopping dead at the
 * last environment. A typed environment sets the starting point, so Tab after
 * typing continues from there.
 */
export function resolveAppTarget(
  app: AppEntry,
  envTerm: string | null,
  step = 0
): AppTarget | null {
  const count = app.environments.length;
  const typedIndex =
    envTerm === null ? -1 : matchEnvironmentIndex(app, envTerm);

  if (typedIndex < 0 && envTerm !== null && envTerm !== '') {
    // Named something this app has never been given an address for. Stepping
    // past a suggestion lands on the stored environments, which is the way
    // back from a typo.
    if (step === 0) {
      const url = deriveEnvUrl(app, envTerm);
      return url === null
        ? firstTarget(app, step)
        : {
            app,
            environment: { name: envTerm.trim(), url },
            index: -1,
            isDerived: true
          };
    }
    return count === 0 ? null : indexTarget(app, (step - 1) % count);
  }

  if (count === 0) {
    return null;
  }
  const start = typedIndex < 0 ? 0 : typedIndex;
  return indexTarget(app, (start + step) % count);
}

function indexTarget(app: AppEntry, index: number): AppTarget {
  return {
    app,
    environment: app.environments[index],
    index,
    isDerived: false
  };
}

function firstTarget(app: AppEntry, step: number): AppTarget | null {
  return app.environments.length === 0
    ? null
    : indexTarget(app, step % app.environments.length);
}
