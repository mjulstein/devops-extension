import type { PatRecord } from '@/types';
import { PAT_SCOPE } from './patApi';
import { PAT_ROTATION_THRESHOLD_MS, decideRotation } from './rotationPolicy';

const NOW = 1_700_000_000_000;

// `null` means "record has no scope field at all" — the legacy shape. A default
// parameter cannot express that, since passing undefined re-triggers the default.
function patExpiringIn(
  ms: number,
  scope: string | null = PAT_SCOPE
): PatRecord {
  return {
    token: 'secret',
    authorizationId: 'auth-1',
    expiresAt: NOW + ms,
    displayName: 'abcd1234-devopsext',
    ...(scope === null ? {} : { scope })
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

  describe('scope changes', () => {
    const HEADROOM = 20 * 60 * 60 * 1000;

    it("returns 'rotate' for a legacy record with no recorded scope", () => {
      expect(decideRotation(patExpiringIn(HEADROOM, null), NOW)).toBe('rotate');
    });

    it("returns 'rotate' when the stored scope is narrower than required", () => {
      expect(
        decideRotation(patExpiringIn(HEADROOM, 'vso.work_write'), NOW)
      ).toBe('rotate');
    });

    it("returns 'use' when the stored scope matches", () => {
      expect(decideRotation(patExpiringIn(HEADROOM, PAT_SCOPE), NOW)).toBe(
        'use'
      );
    });

    it('honours an explicitly supplied required scope', () => {
      expect(decideRotation(patExpiringIn(HEADROOM, 'a.b'), NOW, 'a.b')).toBe(
        'use'
      );
    });

    it('prefers reconnect over a scope rotation when the PAT is expired', () => {
      expect(decideRotation(patExpiringIn(-1, 'vso.work_write'), NOW)).toBe(
        'reconnect'
      );
    });
  });
});
