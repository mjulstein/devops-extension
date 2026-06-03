import type { PatRecord } from '@/types';
import {
  ReconnectNeededError,
  authFetch,
  type AuthFetchDeps
} from './authFetch';
import type { EnsurePatOutcome } from './auth/ensurePat';

const URL = 'https://dev.azure.com/myorg/myproj/_apis/wit/wiql?api-version=7.0';

function pat(token: string): PatRecord {
  return {
    token,
    authorizationId: 'auth',
    expiresAt: Date.now() + 86_400_000,
    displayName: 'abcd1234-devopsext'
  };
}

function connected(token: string): EnsurePatOutcome {
  return { status: 'connected', record: pat(token), rotated: true };
}

function reconnect(): EnsurePatOutcome {
  return { status: 'reconnect-needed', record: null, rotated: false };
}

function makeDeps(overrides: Partial<AuthFetchDeps> = {}): AuthFetchDeps {
  return {
    readPatRecord: vi.fn().mockResolvedValue(pat('stored-token')),
    ensurePat: vi.fn(),
    fetchFn: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    ...overrides
  };
}

function authHeader(call: unknown[]): string | null {
  const init = call[1] as RequestInit;
  return new Headers(init.headers).get('Authorization');
}

describe('authFetch', () => {
  it('sends the stored PAT as Basic auth with credentials omitted', async () => {
    const deps = makeDeps();
    await authFetch(URL, { method: 'GET' }, deps);

    expect(deps.ensurePat).not.toHaveBeenCalled();
    const call = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(authHeader(call)).toBe(`Basic ${btoa(':stored-token')}`);
    expect((call[1] as RequestInit).credentials).toBe('omit');
  });

  it('mints a PAT before the first call when none is stored', async () => {
    const deps = makeDeps({
      readPatRecord: vi.fn().mockResolvedValue(null),
      ensurePat: vi.fn().mockResolvedValue(connected('fresh-token'))
    });

    await authFetch(URL, {}, deps);

    expect(deps.ensurePat).toHaveBeenCalledWith({
      organization: 'myorg',
      force: false
    });
    const call = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(authHeader(call)).toBe(`Basic ${btoa(':fresh-token')}`);
  });

  it('force-rotates once and retries on a 401', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const deps = makeDeps({
      fetchFn,
      ensurePat: vi.fn().mockResolvedValue(connected('rotated-token'))
    });

    const response = await authFetch(URL, {}, deps);

    expect(response.status).toBe(200);
    expect(deps.ensurePat).toHaveBeenCalledWith({
      organization: 'myorg',
      force: true
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(authHeader(fetchFn.mock.calls[1])).toBe(
      `Basic ${btoa(':rotated-token')}`
    );
  });

  it('throws ReconnectNeededError when the retry still 401s', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 401 }));
    const deps = makeDeps({
      fetchFn,
      ensurePat: vi.fn().mockResolvedValue(connected('rotated-token'))
    });

    await expect(authFetch(URL, {}, deps)).rejects.toBeInstanceOf(
      ReconnectNeededError
    );
  });

  it('throws ReconnectNeededError when no PAT exists and none can be minted', async () => {
    const deps = makeDeps({
      readPatRecord: vi.fn().mockResolvedValue(null),
      ensurePat: vi.fn().mockResolvedValue(reconnect())
    });

    await expect(authFetch(URL, {}, deps)).rejects.toBeInstanceOf(
      ReconnectNeededError
    );
    // Never attempted a cookie-auth fetch.
    expect(deps.fetchFn).not.toHaveBeenCalled();
  });

  it('throws when the rotation on 401 cannot mint a new PAT', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 401 }));
    const deps = makeDeps({
      fetchFn,
      ensurePat: vi.fn().mockResolvedValue(reconnect())
    });

    await expect(authFetch(URL, {}, deps)).rejects.toBeInstanceOf(
      ReconnectNeededError
    );
    // Only the initial call happened; no retry with a (non-existent) new token.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
