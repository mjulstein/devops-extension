import type { PatRecord } from '@/types';

// The Extension PAT is minted with ~24h validity and rotated once <12h remains —
// effectively once each working morning. See CONTEXT.md ("Rotate") and spec FR-004.
export const PAT_VALIDITY_MS = 24 * 60 * 60 * 1000;
export const PAT_ROTATION_THRESHOLD_MS = 12 * 60 * 60 * 1000;

// Pure decision over the stored credential — no chrome, no fetch, no clock of its own.
//   'use'       — a valid PAT with comfortable headroom; send it as-is.
//   'rotate'    — still usable but nearing expiry; refresh proactively, old PAT can
//                 keep serving data calls if the rotation itself fails.
//   'reconnect' — no usable PAT (absent or expired); data calls must block until one
//                 is minted. First-time minting takes this same path.
export type RotationDecision = 'use' | 'rotate' | 'reconnect';

export function decideRotation(
  record: PatRecord | null,
  now: number
): RotationDecision {
  if (!record) {
    return 'reconnect';
  }

  const remainingMs = record.expiresAt - now;

  if (remainingMs <= 0) {
    return 'reconnect';
  }

  if (remainingMs < PAT_ROTATION_THRESHOLD_MS) {
    return 'rotate';
  }

  return 'use';
}
