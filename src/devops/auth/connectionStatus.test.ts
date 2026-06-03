import type { PatRecord } from '@/types';
import {
  deriveConnectionStatus,
  shouldAttemptAutoRecovery
} from './connectionStatus';

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

describe('shouldAttemptAutoRecovery', () => {
  it('attempts when reconnect is needed and none has been attempted', () => {
    expect(shouldAttemptAutoRecovery('reconnect-needed', false)).toBe(true);
  });

  it('does not attempt once one has been spent', () => {
    expect(shouldAttemptAutoRecovery('reconnect-needed', true)).toBe(false);
  });

  it('does not attempt when already connected', () => {
    expect(shouldAttemptAutoRecovery('connected', false)).toBe(false);
  });
});
