import type { PatRecord } from '@/types';
import {
  ROTATE_THROTTLE_MS,
  ensurePat,
  type PatApiPort,
  type PatStorePort
} from './ensurePat';
import { PAT_ROTATION_THRESHOLD_MS, PAT_VALIDITY_MS } from './rotationPolicy';

const NOW = 1_700_000_000_000;

function freshBearer(): string {
  const exp = Math.floor(NOW / 1000) + 3600;
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`;
}

function staleBearer(): string {
  const exp = Math.floor(NOW / 1000) - 60;
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`;
}

function makeRecord(overrides: Partial<PatRecord> = {}): PatRecord {
  return {
    token: 'old-secret',
    authorizationId: 'auth-old',
    expiresAt: NOW + PAT_VALIDITY_MS,
    displayName: 'abcd1234-devopsext',
    ...overrides
  };
}

function fakeStore(record: PatRecord | null) {
  const store = {
    written: null as PatRecord | null,
    lastAttempt: null as number | null,
    readPatRecord: vi.fn().mockResolvedValue(record),
    writePatRecord: vi.fn(),
    getDeviceId: vi.fn().mockResolvedValue('abcd1234'),
    buildPatName: (id: string) => `${id}-devopsext`,
    readLastRotateAttemptAt: vi.fn(),
    writeLastRotateAttemptAt: vi.fn()
  } satisfies PatStorePort & {
    written: PatRecord | null;
    lastAttempt: number | null;
  };

  store.writePatRecord.mockImplementation((r: PatRecord) => {
    store.written = r;
    return Promise.resolve();
  });
  store.readLastRotateAttemptAt.mockImplementation(() =>
    Promise.resolve(store.lastAttempt)
  );
  store.writeLastRotateAttemptAt.mockImplementation((n: number) => {
    store.lastAttempt = n;
    return Promise.resolve();
  });
  return store;
}

function fakeApi(
  existingPats: { displayName: string; authorizationId: string }[] = []
): PatApiPort & {
  createPat: ReturnType<typeof vi.fn>;
  revokePat: ReturnType<typeof vi.fn>;
  listExtensionPats: ReturnType<typeof vi.fn>;
} {
  const createPat = vi.fn(
    (
      _bearer: string,
      _org: string,
      displayName: string,
      validToMs: number
    ): Promise<PatRecord> =>
      Promise.resolve({
        token: 'new-secret',
        authorizationId: 'auth-new',
        expiresAt: validToMs,
        displayName
      })
  );
  const revokePat = vi.fn().mockResolvedValue(undefined);
  const listExtensionPats = vi
    .fn()
    .mockResolvedValue(existingPats.map((p) => ({ ...p, validTo: '' })));
  return { createPat, revokePat, listExtensionPats };
}

describe('ensurePat', () => {
  it('uses the existing PAT without minting when it has headroom', async () => {
    const store = fakeStore(makeRecord());
    const api = fakeApi();

    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn(),
      now: NOW,
      store,
      api
    });

    expect(outcome).toEqual({
      status: 'connected',
      record: makeRecord(),
      rotated: false
    });
    expect(api.createPat).not.toHaveBeenCalled();
  });

  it('mints a first PAT when none exists and a fresh Bearer is available', async () => {
    const store = fakeStore(null);
    const api = fakeApi();
    const readBearer = vi.fn().mockResolvedValue(freshBearer());

    const outcome = await ensurePat({
      organization: 'org',
      readBearer,
      now: NOW,
      store,
      api
    });

    expect(outcome.status).toBe('connected');
    expect(outcome.rotated).toBe(true);
    expect(outcome.record?.authorizationId).toBe('auth-new');
    expect(api.createPat).toHaveBeenCalledWith(
      expect.any(String),
      'org',
      'abcd1234-devopsext',
      NOW + PAT_VALIDITY_MS
    );
    // Nothing to revoke on first mint.
    expect(api.revokePat).not.toHaveBeenCalled();
    expect(store.written?.authorizationId).toBe('auth-new');
  });

  it('rotates and revokes the old PAT when under the threshold with a fresh Bearer', async () => {
    const store = fakeStore(
      makeRecord({ expiresAt: NOW + PAT_ROTATION_THRESHOLD_MS - 1 })
    );
    const api = fakeApi([
      { displayName: 'abcd1234-devopsext', authorizationId: 'auth-old' }
    ]);

    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(freshBearer()),
      now: NOW,
      store,
      api
    });

    expect(outcome.rotated).toBe(true);
    expect(outcome.status).toBe('connected');
    expect(api.revokePat).toHaveBeenCalledWith(
      expect.any(String),
      'org',
      'auth-old'
    );
  });

  it('reports reconnect-needed when no PAT exists and no Bearer is available', async () => {
    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(null),
      now: NOW,
      store: fakeStore(null),
      api: fakeApi()
    });

    expect(outcome).toMatchObject({
      status: 'reconnect-needed',
      record: null,
      rotated: false
    });
  });

  it('treats a stale Bearer as no Bearer (never fires it)', async () => {
    const api = fakeApi();
    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(staleBearer()),
      now: NOW,
      store: fakeStore(null),
      api
    });

    expect(outcome.status).toBe('reconnect-needed');
    expect(api.createPat).not.toHaveBeenCalled();
  });

  it('stays Connected on a rotate that cannot mint (old PAT still valid)', async () => {
    const record = makeRecord({
      expiresAt: NOW + PAT_ROTATION_THRESHOLD_MS - 1
    });
    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(null),
      now: NOW,
      store: fakeStore(record),
      api: fakeApi()
    });

    expect(outcome).toMatchObject({
      status: 'connected',
      record,
      rotated: false
    });
  });

  it('skips the attempt when a recent rotation was throttled (reconnect case)', async () => {
    const store = fakeStore(null);
    store.lastAttempt = NOW - 1000;
    const readBearer = vi.fn();

    const outcome = await ensurePat({
      organization: 'org',
      readBearer,
      now: NOW,
      throttleMs: ROTATE_THROTTLE_MS,
      store,
      api: fakeApi()
    });

    expect(outcome.status).toBe('reconnect-needed');
    expect(readBearer).not.toHaveBeenCalled();
  });

  it('bypasses the throttle for the deliberate auto-recovery attempt', async () => {
    const store = fakeStore(null);
    store.lastAttempt = NOW - 1000;
    const readBearer = vi.fn().mockResolvedValue(freshBearer());

    const outcome = await ensurePat({
      organization: 'org',
      readBearer,
      now: NOW,
      bypassThrottle: true,
      store,
      api: fakeApi()
    });

    expect(readBearer).toHaveBeenCalled();
    expect(outcome.rotated).toBe(true);
  });

  it('force-rotates a not-yet-expired but rejected PAT', async () => {
    // Plenty of headroom — decideRotation would say 'use', but force overrides.
    const store = fakeStore(makeRecord());
    const api = fakeApi([
      { displayName: 'abcd1234-devopsext', authorizationId: 'auth-old' }
    ]);

    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(freshBearer()),
      now: NOW,
      force: true,
      store,
      api
    });

    expect(outcome.rotated).toBe(true);
    expect(api.createPat).toHaveBeenCalled();
    expect(api.revokePat).toHaveBeenCalledWith(
      expect.any(String),
      'org',
      'auth-old'
    );
  });

  it('reports reconnect-needed when a forced rotation cannot mint', async () => {
    // force means the old PAT is known bad, so failure is reconnect-needed even
    // though the record has not expired.
    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(null),
      now: NOW,
      force: true,
      store: fakeStore(makeRecord()),
      api: fakeApi()
    });

    expect(outcome.status).toBe('reconnect-needed');
  });

  it('revokes all registry entries matching the device name before minting', async () => {
    const api = fakeApi([
      { displayName: 'abcd1234-devopsext', authorizationId: 'orphan-1' },
      { displayName: 'abcd1234-devopsext', authorizationId: 'orphan-2' },
      { displayName: 'other-device-devopsext', authorizationId: 'unrelated' }
    ]);

    await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(freshBearer()),
      now: NOW,
      store: fakeStore(null),
      api
    });

    expect(api.revokePat).toHaveBeenCalledWith(
      expect.any(String),
      'org',
      'orphan-1'
    );
    expect(api.revokePat).toHaveBeenCalledWith(
      expect.any(String),
      'org',
      'orphan-2'
    );
    expect(api.revokePat).not.toHaveBeenCalledWith(
      expect.any(String),
      'org',
      'unrelated'
    );
    expect(api.createPat).toHaveBeenCalledTimes(1);
  });

  it('reports reconnect-needed when minting throws and no PAT was usable', async () => {
    const api = fakeApi();
    api.createPat.mockRejectedValue(new Error('boom'));

    const outcome = await ensurePat({
      organization: 'org',
      readBearer: vi.fn().mockResolvedValue(freshBearer()),
      now: NOW,
      store: fakeStore(null),
      api
    });

    expect(outcome.status).toBe('reconnect-needed');
  });
});
