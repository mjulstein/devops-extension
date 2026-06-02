import type { PatRecord } from '@/types';

// Storage + parse for the Extension PAT. The only place that knows the
// chrome.storage.local key names and the PatRecord shape.

export const PAT_RECORD_KEY = 'devopsExtPat';
export const DEVICE_ID_KEY = 'devopsExtDeviceId';
// Additive key (constitution IV): throttles rotation so a failing rotation does
// not retry on every interaction. See spec FR-006.
export const LAST_ROTATE_ATTEMPT_KEY = 'devopsExtLastRotateAttemptAt';

const PAT_SUFFIX = '-devopsext';

export function buildPatName(deviceId: string): string {
  return `${deviceId}${PAT_SUFFIX}`;
}

export function parsePatRecord(value: unknown): PatRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.token !== 'string' ||
    typeof value.authorizationId !== 'string' ||
    typeof value.expiresAt !== 'number' ||
    typeof value.displayName !== 'string'
  ) {
    return null;
  }
  return {
    token: value.token,
    authorizationId: value.authorizationId,
    expiresAt: value.expiresAt,
    displayName: value.displayName
  };
}

export async function readPatRecord(): Promise<PatRecord | null> {
  const stored = await chrome.storage.local.get(PAT_RECORD_KEY);
  return parsePatRecord(stored[PAT_RECORD_KEY]);
}

export async function writePatRecord(record: PatRecord): Promise<void> {
  await chrome.storage.local.set({ [PAT_RECORD_KEY]: record });
}

export async function clearPatRecord(): Promise<void> {
  await chrome.storage.local.remove(PAT_RECORD_KEY);
}

export async function getDeviceId(): Promise<string> {
  const stored = await chrome.storage.local.get(DEVICE_ID_KEY);
  const existing = stored[DEVICE_ID_KEY];
  if (typeof existing === 'string' && existing) {
    return existing;
  }
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  await chrome.storage.local.set({ [DEVICE_ID_KEY]: id });
  return id;
}

export async function readLastRotateAttemptAt(): Promise<number | null> {
  const stored = await chrome.storage.local.get(LAST_ROTATE_ATTEMPT_KEY);
  const value = stored[LAST_ROTATE_ATTEMPT_KEY];
  return typeof value === 'number' ? value : null;
}

export async function writeLastRotateAttemptAt(now: number): Promise<void> {
  await chrome.storage.local.set({ [LAST_ROTATE_ATTEMPT_KEY]: now });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
