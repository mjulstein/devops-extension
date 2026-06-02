import type { PatRecord } from '@/types';
import {
  parsePatRecord,
  PAT_RECORD_KEY,
  DEVICE_ID_KEY,
  LAST_ROTATE_ATTEMPT_KEY
} from '@/devops/auth/patStore';

interface RuntimeResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

// Service worker has a 15 s PAT-API timeout; 25 s here catches the case where
// the Edge MV3 service worker is killed mid-operation and the port never closes.
const ROTATE_MESSAGE_TIMEOUT_MS = 25_000;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    )
  ]);
}

export async function rotatePat(organization: string): Promise<PatRecord> {
  const response: RuntimeResult = await withTimeout(
    chrome.runtime.sendMessage({
      type: 'ROTATE_PAT',
      payload: { organization }
    }),
    ROTATE_MESSAGE_TIMEOUT_MS,
    'PAT rotation timed out. Make sure an Azure DevOps tab is open and try again.'
  );

  if (!response?.ok) {
    throw new Error(response?.error ?? 'PAT rotation failed.');
  }

  const record = parsePatRecord(response.result);
  if (!record) {
    throw new Error('PAT rotation returned an unexpected response.');
  }

  return record;
}

export async function revokeAllExtensionPats(
  organization: string
): Promise<number> {
  const response: RuntimeResult = await chrome.runtime.sendMessage({
    type: 'REVOKE_ALL_EXTENSION_PATS',
    payload: { organization }
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? 'PAT revocation failed.');
  }

  return typeof response.result === 'number' ? response.result : 0;
}

export async function loadPatStatus(): Promise<{
  record: PatRecord | null;
  deviceId: string | null;
}> {
  const stored = await chrome.storage.local.get([
    PAT_RECORD_KEY,
    DEVICE_ID_KEY
  ]);
  return {
    record: parsePatRecord(stored[PAT_RECORD_KEY]),
    deviceId:
      typeof stored[DEVICE_ID_KEY] === 'string' && stored[DEVICE_ID_KEY]
        ? stored[DEVICE_ID_KEY]
        : null
  };
}

// Wipes all PAT-related storage so the extension starts fresh on the next
// bearer capture. Use when the PAT is stuck or rotation is not working.
export async function clearPatData(): Promise<void> {
  await chrome.storage.local.remove([
    PAT_RECORD_KEY,
    DEVICE_ID_KEY,
    LAST_ROTATE_ATTEMPT_KEY
  ]);
}
