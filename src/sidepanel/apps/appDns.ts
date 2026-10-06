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

export interface ParsedAppUrl {
  /** The app's own address, with any environment marker taken off. */
  appHost: string;
  /** A folder name for the app: the label that identifies it. */
  appName: string;
  /** The environment the address names, if it names one. */
  envName: string | null;
  style: AppDnsStyle;
}

/** The label an app is known by: the leftmost part of its own address. */
function nameFromHost(host: string): string {
  return splitHost(host).label;
}

/**
 * What a single address says about the app and environment it belongs to.
 *
 * The subdomain is the tell. A subdomain with no hyphen in it is an environment
 * — `test.my-app.com` is the test environment of `my-app.com` — because an app
 * whose name needs no hyphen is not what a subdomain there usually means. A
 * subdomain *with* a hyphen is the app itself, sitting under somebody's domain:
 * `my-app.orgname.com`. And `www`, or no subdomain at all, is the app on its own
 * domain with no environment named.
 *
 * Naming the environment removes the guesswork entirely, which is what the
 * commands do: told that this is `test`, the marker can be found in the address
 * and taken off, so `my-app-test.orgname.com` files under `my-app` rather than
 * under an app that looks like it is called `my-app-test`.
 */
export function parseAppUrl(
  rawUrl: string,
  knownEnv: string | null = null
): ParsedAppUrl | null {
  const host = hostOf(rawUrl);
  if (host === null || host === '') {
    return null;
  }

  const { label: sub, rest } = splitHost(host);
  const token = knownEnv === null ? null : envToken(knownEnv);

  if (token !== null && token !== '' && rest !== '') {
    if (sub === token) {
      return {
        appHost: rest,
        appName: nameFromHost(rest),
        envName: knownEnv,
        style: 'own-domain'
      };
    }
    if (sub.endsWith(`-${token}`)) {
      const label = sub.slice(0, -(token.length + 1));
      return {
        appHost: `${label}.${rest}`,
        appName: label,
        envName: knownEnv,
        style: 'org-subdomain'
      };
    }
  }

  // No subdomain: the app is the domain itself.
  if (rest === '' || host.split('.').length <= 2) {
    return {
      appHost: host,
      appName: nameFromHost(host),
      envName: knownEnv,
      style: 'own-domain'
    };
  }

  if (sub === 'www') {
    return {
      appHost: rest,
      appName: nameFromHost(rest),
      envName: knownEnv,
      style: 'own-domain'
    };
  }

  if (!sub.includes('-')) {
    return {
      appHost: rest,
      appName: nameFromHost(rest),
      envName: knownEnv ?? sub,
      style: 'own-domain'
    };
  }

  return {
    appHost: host,
    appName: sub,
    envName: knownEnv,
    style: 'org-subdomain'
  };
}

/** An environment name as it appears in a hostname. */
export function envToken(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * What a typed address means.
 *
 * A host typed into a command is an address, not a relative path: `https://` is
 * put in front of anything that does not already say otherwise. An explicit
 * `http://` is kept, which is the whole reason this is a rule rather than a
 * silent upgrade, and so is any other scheme — a `chrome://` page typed in full
 * should not be turned into a web address.
 */
export function normalizeTypedUrl(value: string): string {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
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

  // Nothing to compare: the one address is read on its own terms.
  const only = environments[0];
  return only ? (parseAppUrl(only.url)?.style ?? 'own-domain') : 'own-domain';
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
