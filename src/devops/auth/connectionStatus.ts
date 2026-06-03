import type { PatRecord } from '@/types';
import { readPatRecord } from './patStore';

// The provider-agnostic status the side panel reads to decide whether it can act.
// Derived from PAT validity — never a separately stored flag (CONTEXT.md, FR-009).
//   Connected        — a valid (unexpired) PAT exists; data requests are allowed.
//   ReconnectNeeded   — no valid PAT; data requests are blocked, reconnect is shown.
export type ConnectionStatus = 'connected' | 'reconnect-needed';

export function deriveConnectionStatus(
  record: PatRecord | null,
  now: number
): ConnectionStatus {
  return record && record.expiresAt > now ? 'connected' : 'reconnect-needed';
}

export async function getConnectionStatus(
  now: number = Date.now()
): Promise<ConnectionStatus> {
  return deriveConnectionStatus(await readPatRecord(), now);
}

// On capture of a fresh Bearer the extension attempts exactly one automatic
// rotation; a second capture must not fire another until the cycle resets
// (success, or a manual Retry). See spec FR-008 / US-2.
export function shouldAttemptAutoRecovery(
  status: ConnectionStatus,
  autoRecoveryAttempted: boolean
): boolean {
  return status === 'reconnect-needed' && !autoRecoveryAttempted;
}
