import type { PatRecord } from '@/types';
import { PAT_VALIDITY_MS, decideRotation } from './rotationPolicy';
import {
  DEFAULT_FRESHNESS_MARGIN_MS,
  decodeJwtExp,
  isFresh
} from './bearerToken';
import {
  buildPatName,
  getDeviceId,
  readLastRotateAttemptAt,
  readPatRecord,
  writeLastRotateAttemptAt,
  writePatRecord
} from './patStore';
import { createPat, listExtensionPats, revokePat } from './patApi';
import type { RemotePatSummary } from './patApi';
import { readBearerFromTab } from './readBearerFromTab';

// Orchestrates the PAT lifecycle in the service worker:
//   store -> rotationPolicy -> (if minting) fresh Bearer -> patApi -> persist.
// Returns the derived connection status so callers never read a separate flag.

type ConnectionStatusValue = 'connected' | 'reconnect-needed';

export interface EnsurePatOutcome {
  status: ConnectionStatusValue;
  record: PatRecord | null;
  rotated: boolean;
  // Set when a forced rotation (force=true) fails at the API call level, so
  // callers like ROTATE_PAT can surface the real reason instead of a generic message.
  mintError?: string;
}

// A failing rotation must not retry on every interaction (spec FR-006). Lazy
// triggers respect this window; the deliberate auto-recovery attempt bypasses it.
export const ROTATE_THROTTLE_MS = 5 * 60 * 1000;

export interface PatStorePort {
  readPatRecord(): Promise<PatRecord | null>;
  writePatRecord(record: PatRecord): Promise<void>;
  getDeviceId(): Promise<string>;
  buildPatName(deviceId: string): string;
  readLastRotateAttemptAt(): Promise<number | null>;
  writeLastRotateAttemptAt(now: number): Promise<void>;
}

export interface PatApiPort {
  createPat(
    bearerToken: string,
    organization: string,
    displayName: string,
    validToMs: number
  ): Promise<PatRecord>;
  revokePat(
    bearerToken: string,
    organization: string,
    authorizationId: string
  ): Promise<void>;
  listExtensionPats(
    bearerToken: string,
    organization: string
  ): Promise<RemotePatSummary[]>;
}

export interface EnsurePatOptions {
  organization: string;
  // Reads the Bearer captured in an Azure DevOps tab's main world, or null when
  // no tab / no captured token is available. Defaults to the real tab reader.
  readBearer?: () => Promise<string | null>;
  now?: number;
  // Bypass the rotation throttle (deliberate triggers: 401 retry, auto-recovery).
  bypassThrottle?: boolean;
  // The current PAT is known bad (e.g. a 401 rejection): mint a new one even if it
  // hasn't expired, and never fall back to it. Implies bypassThrottle.
  force?: boolean;
  freshnessMarginMs?: number;
  throttleMs?: number;
  store?: PatStorePort;
  api?: PatApiPort;
}

const defaultStore: PatStorePort = {
  readPatRecord,
  writePatRecord,
  getDeviceId,
  buildPatName,
  readLastRotateAttemptAt,
  writeLastRotateAttemptAt
};

const defaultApi: PatApiPort = { createPat, revokePat, listExtensionPats };

export async function ensurePat(
  options: EnsurePatOptions
): Promise<EnsurePatOutcome> {
  const {
    organization,
    readBearer = readBearerFromTab,
    now = Date.now(),
    force = false,
    bypassThrottle = force,
    freshnessMarginMs = DEFAULT_FRESHNESS_MARGIN_MS,
    throttleMs = ROTATE_THROTTLE_MS,
    store = defaultStore,
    api = defaultApi
  } = options;

  const record = await store.readPatRecord();
  const decision = decideRotation(record, now);

  if (decision === 'use' && !force) {
    return { status: 'connected', record, rotated: false };
  }

  // The old PAT is a safe fallback only when it is still valid AND not force-
  // invalidated. Otherwise a failed mint means we genuinely cannot connect.
  const canFallBackToOld = !force && decision === 'rotate';
  const fallback = (): EnsurePatOutcome =>
    canFallBackToOld
      ? { status: 'connected', record, rotated: false }
      : { status: 'reconnect-needed', record: null, rotated: false };

  if (!bypassThrottle) {
    const lastAttempt = await store.readLastRotateAttemptAt();
    if (lastAttempt !== null && now - lastAttempt < throttleMs) {
      return fallback();
    }
  }

  await store.writeLastRotateAttemptAt(now);

  const bearer = await readBearer();
  if (!bearer) {
    return {
      ...fallback(),
      mintError: 'no bearer token found in any DevOps tab'
    };
  }
  if (!isFresh(bearer, freshnessMarginMs, now)) {
    const exp = decodeJwtExp(bearer);
    return {
      ...fallback(),
      mintError:
        exp === null
          ? 'bearer token is not a decodable JWT (no exp claim) — Chrome may use a non-JWT token format'
          : `bearer token expired or within freshness margin (exp=${exp}, now=${Math.floor(now / 1000)})`
    };
  }

  try {
    const deviceId = await store.getDeviceId();
    const displayName = store.buildPatName(deviceId);

    // Revoke all registry entries with this device's PAT name before minting.
    // This catches orphans from previous sessions and handles the normal rotation
    // case without relying on the stored authorizationId being current.
    const existing = await api.listExtensionPats(bearer, organization);
    await Promise.all(
      existing
        .filter((p) => p.displayName === displayName)
        .map((p) =>
          api
            .revokePat(bearer, organization, p.authorizationId)
            .catch(() => undefined)
        )
    );

    const fresh = await api.createPat(
      bearer,
      organization,
      displayName,
      now + PAT_VALIDITY_MS
    );
    await store.writePatRecord(fresh);

    return { status: 'connected', record: fresh, rotated: true };
  } catch (err) {
    const mintError = err instanceof Error ? err.message : String(err);
    return { ...fallback(), mintError };
  }
}
