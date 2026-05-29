import type { PatRecord } from '@/types';
import { parsePatRecord, PAT_RECORD_KEY } from '@/devops/patLifecycle';

export async function rotatePat(organization: string): Promise<PatRecord> {
  const response = await chrome.runtime.sendMessage({
    type: 'ROTATE_PAT',
    payload: { organization }
  }) as { ok: boolean; result?: unknown; error?: string };

  if (!response?.ok) {
    throw new Error(response?.error ?? 'PAT rotation failed.');
  }

  const record = parsePatRecord(response.result);
  if (!record) {
    throw new Error('PAT rotation returned an unexpected response.');
  }

  return record;
}

export async function revokeAllExtensionPats(organization: string): Promise<number> {
  const response = await chrome.runtime.sendMessage({
    type: 'REVOKE_ALL_EXTENSION_PATS',
    payload: { organization }
  }) as { ok: boolean; result?: unknown; error?: string };

  if (!response?.ok) {
    throw new Error(response?.error ?? 'PAT revocation failed.');
  }

  return typeof response.result === 'number' ? response.result : 0;
}

export async function loadPatStatus(): Promise<{
  record: PatRecord | null;
  deviceId: string | null;
}> {
  const stored = await chrome.storage.local.get([PAT_RECORD_KEY, 'devopsExtDeviceId']);
  return {
    record: parsePatRecord(stored[PAT_RECORD_KEY]),
    deviceId:
      typeof stored['devopsExtDeviceId'] === 'string' && stored['devopsExtDeviceId']
        ? (stored['devopsExtDeviceId'] as string)
        : null
  };
}
