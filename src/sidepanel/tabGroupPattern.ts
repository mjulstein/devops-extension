// What a group's definition matches.
//
// A definition starts as a bare domain, because that is the thing you can name
// without looking anything up, and `example.com` keeps matching everything
// under it. Past that it is a pattern:
//
//   wiki.*/spaces      a sub-domain and a path, either side wildcarded
//   localhost:3000     a port, which is as much part of an address as a path
//   */_git             any host, one path
//
// `*` stands for any run of characters.
//
// The scheme is part of the pattern and defaults to https, which is what nearly
// everything is: write `http://localhost:1234/path` when you mean the other
// one. That is the same bargain the app commands make with a typed address, and
// it is one field rather than two.

export interface PatternParts {
  /** The scheme an address must have, with its colon. */
  scheme: string;
  /** Before the first `/`: a host, optionally with a port. */
  host: string;
  /** From the first `/` on, or empty when the pattern names no path. */
  path: string;
}

/** Splits a definition into the scheme, the host half and the path half. */
export function splitPattern(pattern: string): PatternParts {
  const trimmed = pattern.trim().toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//.exec(trimmed);
  const rest = (
    scheme === null ? trimmed : trimmed.slice(scheme[0].length)
  ).replace(/^\.+/, '');
  const at = rest.indexOf('/');

  return {
    scheme: scheme === null ? 'https:' : `${scheme[1]}:`,
    host: at < 0 ? rest : rest.slice(0, at),
    path: at < 0 ? '' : rest.slice(at)
  };
}

function toRegExp(pattern: string, anchorEnd: boolean): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (match) =>
    match === '*' ? '\u0000' : `\\${match}`
  );
  const body = escaped.split('\u0000').join('.*');
  return new RegExp(`^${body}${anchorEnd ? '$' : ''}`);
}

/**
 * Whether an address's host answers to this half of a definition.
 *
 * Three readings, in the order that keeps the simple case simple:
 *
 * - with a `*`, the pattern is taken literally and must match the whole host,
 *   port included — writing a wildcard means you know what you are asking for;
 * - with a `:`, it is an exact host and port, because naming a port is the only
 *   reason to write one;
 * - otherwise it is a domain, and matches that domain or anything under it,
 *   which is what `example.com` has always meant here.
 */
export function hostMatchesPattern(url: URL, pattern: string): boolean {
  const host = url.host.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  const wanted = pattern.trim().toLowerCase();

  if (wanted === '') {
    return false;
  }
  if (wanted.includes('*')) {
    return toRegExp(wanted, true).test(host);
  }
  if (wanted.includes(':')) {
    return host === wanted;
  }
  return hostname === wanted || hostname.endsWith(`.${wanted}`);
}

/** Whether the address's path starts with this half of a definition. */
export function pathMatchesPattern(url: URL, pattern: string): boolean {
  if (pattern === '') {
    return true;
  }
  return toRegExp(pattern, false).test(url.pathname.toLowerCase());
}

/**
 * Whether an address belongs to a group defined this way.
 *
 * Unparseable addresses belong to nothing: a group that swallowed them would
 * be holding something nobody could act on.
 */
export function urlMatchesPattern(rawUrl: string, pattern: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const { scheme, host, path } = splitPattern(pattern);
  return (
    url.protocol === scheme &&
    hostMatchesPattern(url, host) &&
    pathMatchesPattern(url, path)
  );
}

/**
 * An address to open for a group, or null when the pattern does not name one.
 *
 * A definition is a shape, not a place: `wiki.*` describes many addresses and
 * picks none. Only a pattern with no wildcard in it can be opened, which is
 * most of them — the ones written for a single host or a single local port.
 */
export function patternToUrl(pattern: string): string | null {
  const { scheme, host, path } = splitPattern(pattern);
  if (host === '' || host.includes('*') || path.includes('*')) {
    return null;
  }
  return `${scheme}//${host}${path}`;
}
