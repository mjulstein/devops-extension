// Working out an app's other environments from the ones you already have.
//
// Two shapes of address turn up, and they put the environment in opposite
// places:
//
//   my-app.orgname.com   ->  my-app-test.orgname.com   (suffixed on the app label)
//   my-app.com           ->  test.my-app.com           (prefixed as a label)
//
// Which one an app uses is never configured and never guessed from a list of
// known environment names: it is read back out of the addresses already stored
// for that app. Two environments are enough to see the pattern outright, and
// with only one the label count decides — a name three labels deep is somebody's
// subdomain, a name two labels deep is the app's own domain.
//
// Derivation is only ever a *suggestion*. Real deployments are inconsistent —
// `my-app` in one environment and `myapp` in the next — so a stored address
// always wins, and adding an environment stores the address that actually
// worked rather than the one that was guessed.

export interface AppEnvironment {
  /**
   * The environment's name, taken from its bookmark title. Never interpreted:
   * nothing here knows what "prod" means, and nothing should.
   */
  name: string;
  url: string;
}

export interface AppEntry {
  name: string;
  /**
   * In the order the bookmarks sit in the folder, which is the user's own
   * ordering and the order the keyboard walks.
   */
  environments: AppEnvironment[];
}

export type AppDnsStyle = 'org-subdomain' | 'own-domain';

/** An environment name as it appears in a hostname. */
export function envToken(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function splitHost(host: string): { label: string; rest: string } {
  const index = host.indexOf('.');
  return index < 0
    ? { label: host, rest: '' }
    : { label: host.slice(0, index), rest: host.slice(index + 1) };
}

/**
 * Which shape this app's addresses take.
 *
 * Evidence first: if one environment's host is another's with the name in front
 * or appended to the first label, that settles it without any guessing. Only
 * when there is nothing to compare does the label count decide.
 */
export function inferDnsStyle(environments: AppEnvironment[]): AppDnsStyle {
  for (const base of environments) {
    const baseHost = hostOf(base.url);
    if (baseHost === null) {
      continue;
    }
    const { label, rest } = splitHost(baseHost);

    for (const other of environments) {
      if (other === base) {
        continue;
      }
      const otherHost = hostOf(other.url);
      const token = envToken(other.name);
      if (otherHost === null || token === '') {
        continue;
      }
      if (otherHost === `${token}.${baseHost}`) {
        return 'own-domain';
      }
      if (rest !== '' && otherHost === `${label}-${token}.${rest}`) {
        return 'org-subdomain';
      }
    }
  }

  // Neither environment is the plain one: every address carries its own
  // marker, so they are compared with the markers taken off instead. A folder
  // holding only `test` and `dev` has no unmarked address to measure from, and
  // without this it reads as whatever the label count happens to say.
  const bare = (style: AppDnsStyle) =>
    environments.map((environment) => {
      const host = hostOf(environment.url);
      const token = envToken(environment.name);
      if (host === null || token === '') {
        return null;
      }
      if (style === 'own-domain') {
        return host.startsWith(`${token}.`)
          ? host.slice(token.length + 1)
          : null;
      }
      const { label, rest } = splitHost(host);
      return label.endsWith(`-${token}`) && rest !== ''
        ? `${label.slice(0, -(token.length + 1))}.${rest}`
        : null;
    });

  for (const style of ['own-domain', 'org-subdomain'] as const) {
    const hosts = bare(style);
    if (
      hosts.length >= 2 &&
      hosts.every((host) => host !== null && host === hosts[0])
    ) {
      return style;
    }
  }

  const first = environments[0] ? hostOf(environments[0].url) : null;
  return first !== null && first.split('.').length >= 3
    ? 'org-subdomain'
    : 'own-domain';
}

/**
 * The app's address with the environment marker taken off.
 *
 * The first environment is the one measured from, because it is the one the
 * user put first. If that environment's own name is present in its host — a
 * folder whose first entry is `test` at `my-app-test.orgname.com` — it comes
 * off, so the rest are built from `my-app.orgname.com` rather than from
 * `my-app-test-dev.orgname.com`.
 */
export function appBaseHost(app: AppEntry): string | null {
  const first = app.environments[0];
  if (!first) {
    return null;
  }
  const host = hostOf(first.url);
  if (host === null) {
    return null;
  }

  const token = envToken(first.name);
  if (token === '') {
    return host;
  }

  if (inferDnsStyle(app.environments) === 'own-domain') {
    return host.startsWith(`${token}.`) ? host.slice(token.length + 1) : host;
  }

  const { label, rest } = splitHost(host);
  return label.endsWith(`-${token}`) && rest !== ''
    ? `${label.slice(0, -(token.length + 1))}.${rest}`
    : host;
}

/**
 * The address an environment would have if it followed the app's pattern.
 *
 * Null when there is nothing to pattern it on. The protocol, port and path of
 * the first environment are kept: an app served from a path in one environment
 * is served from the same path in the next far more often than not, and a
 * suggestion that drops it is a suggestion that has to be edited every time.
 */
export function deriveEnvUrl(app: AppEntry, envName: string): string | null {
  const first = app.environments[0];
  const base = appBaseHost(app);
  const token = envToken(envName);
  if (!first || base === null || token === '') {
    return null;
  }

  let host: string;
  if (inferDnsStyle(app.environments) === 'own-domain') {
    host = `${token}.${base}`;
  } else {
    const { label, rest } = splitHost(base);
    host = rest === '' ? `${label}-${token}` : `${label}-${token}.${rest}`;
  }

  try {
    const url = new URL(first.url);
    url.hostname = host;
    return url.toString();
  } catch {
    return null;
  }
}
