import {
  DEFAULT_FRESHNESS_MARGIN_MS,
  decodeJwtExp,
  isFresh
} from './bearerToken';

const NOW = 1_700_000_000_000;

// Build a minimal unsigned JWT (header.payload.signature) with the given payload.
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

describe('decodeJwtExp', () => {
  it('reads the exp claim from a JWT', () => {
    const exp = Math.floor(NOW / 1000) + 3600;
    expect(decodeJwtExp(makeJwt({ exp }))).toBe(exp);
  });

  it('strips a leading "Bearer " prefix', () => {
    const exp = Math.floor(NOW / 1000) + 3600;
    expect(decodeJwtExp(`Bearer ${makeJwt({ exp })}`)).toBe(exp);
  });

  it('returns null when there is no exp claim', () => {
    expect(decodeJwtExp(makeJwt({ sub: 'user' }))).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwtExp('not-a-jwt')).toBeNull();
    expect(decodeJwtExp('only.two')).toBe(null);
    expect(decodeJwtExp('a.!!!notbase64!!!.c')).toBeNull();
  });
});

describe('isFresh', () => {
  it('is fresh when exp is comfortably in the future', () => {
    const token = makeJwt({ exp: Math.floor(NOW / 1000) + 3600 });
    expect(isFresh(token, DEFAULT_FRESHNESS_MARGIN_MS, NOW)).toBe(true);
  });

  it('is stale when exp is in the past', () => {
    const token = makeJwt({ exp: Math.floor(NOW / 1000) - 60 });
    expect(isFresh(token, DEFAULT_FRESHNESS_MARGIN_MS, NOW)).toBe(false);
  });

  it('is stale when exp is within the freshness margin', () => {
    const exp = Math.floor((NOW + DEFAULT_FRESHNESS_MARGIN_MS - 1000) / 1000);
    const token = makeJwt({ exp });
    expect(isFresh(token, DEFAULT_FRESHNESS_MARGIN_MS, NOW)).toBe(false);
  });

  it('is never fresh for a malformed token', () => {
    expect(isFresh('garbage', DEFAULT_FRESHNESS_MARGIN_MS, NOW)).toBe(false);
  });
});
