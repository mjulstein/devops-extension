import type { PatRecord } from '@/types';
import { deriveConnectionStatus } from './connectionStatus';

const NOW = 1_700_000_000_000;

function pat(expiresAt: number): PatRecord {
  return {
    token: 't',
    authorizationId: 'a',
    expiresAt,
    displayName: 'abcd1234-devopsext'
  };
}

describe('deriveConnectionStatus', () => {
  it('is connected when a valid PAT exists', () => {
    expect(deriveConnectionStatus(pat(NOW + 1000), NOW)).toBe('connected');
  });

  it('is reconnect-needed when there is no PAT', () => {
    expect(deriveConnectionStatus(null, NOW)).toBe('reconnect-needed');
  });

  it('is reconnect-needed when the PAT has expired', () => {
    expect(deriveConnectionStatus(pat(NOW), NOW)).toBe('reconnect-needed');
    expect(deriveConnectionStatus(pat(NOW - 1), NOW)).toBe('reconnect-needed');
  });
});
