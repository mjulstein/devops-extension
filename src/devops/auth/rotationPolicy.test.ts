import type { PatRecord } from '@/types';
import { PAT_ROTATION_THRESHOLD_MS, decideRotation } from './rotationPolicy';

const NOW = 1_700_000_000_000;

function patExpiringIn(ms: number): PatRecord {
  return {
    token: 'secret',
    authorizationId: 'auth-1',
    expiresAt: NOW + ms,
    displayName: 'abcd1234-devopsext'
  };
}

describe('decideRotation', () => {
  it("returns 'reconnect' when there is no record", () => {
    expect(decideRotation(null, NOW)).toBe('reconnect');
  });

  it("returns 'reconnect' when the PAT has expired", () => {
    expect(decideRotation(patExpiringIn(-1), NOW)).toBe('reconnect');
  });

  it("returns 'reconnect' at the exact moment of expiry", () => {
    expect(decideRotation(patExpiringIn(0), NOW)).toBe('reconnect');
  });

  it("returns 'rotate' when under the 12h threshold but still valid", () => {
    expect(
      decideRotation(patExpiringIn(PAT_ROTATION_THRESHOLD_MS - 1), NOW)
    ).toBe('rotate');
  });

  it("returns 'use' at exactly the 12h threshold", () => {
    expect(decideRotation(patExpiringIn(PAT_ROTATION_THRESHOLD_MS), NOW)).toBe(
      'use'
    );
  });

  it("returns 'use' with comfortable headroom", () => {
    expect(decideRotation(patExpiringIn(20 * 60 * 60 * 1000), NOW)).toBe('use');
  });
});
