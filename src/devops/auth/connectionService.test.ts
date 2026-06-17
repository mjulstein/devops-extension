import {
  createConnectionService,
  type ConnectionBroadcast,
  type ConnectionServiceDeps
} from './connectionService';
import type { ConnectionStatus } from './connectionStatus';
import type { EnsurePatOutcome } from './ensurePat';

function outcome(status: ConnectionStatus): EnsurePatOutcome {
  return {
    status,
    record:
      status === 'connected'
        ? {
            token: 't',
            authorizationId: 'a',
            expiresAt: Date.now() + 86_400_000,
            displayName: 'abcd1234-devopsext'
          }
        : null,
    rotated: status === 'connected'
  };
}

function setup(overrides: Partial<ConnectionServiceDeps> = {}) {
  const broadcasts: ConnectionBroadcast[] = [];
  const deps: ConnectionServiceDeps = {
    ensurePat: vi.fn().mockResolvedValue(outcome('connected')),
    getConnectionStatus: vi.fn().mockResolvedValue('reconnect-needed'),
    resolveOrganization: vi.fn().mockResolvedValue('myorg'),
    broadcast: (payload) => broadcasts.push(payload),
    ...overrides
  };
  return { service: createConnectionService(deps), deps, broadcasts };
}

describe('connectionService recovery transitions', () => {
  it('blocks a mid-flight second trigger while the first rotation is in progress', async () => {
    // Simulate two concurrent handleBearerCaptured calls — the second must not
    // start a rotation because recoveryInFlight is latched before the first awaits
    // resolveOrganization, so they cannot both mint before the throttle is written.
    let resolveFirst!: (v: EnsurePatOutcome) => void;
    const firstPending = new Promise<EnsurePatOutcome>(
      (res) => (resolveFirst = res)
    );
    const ensure = vi
      .fn()
      .mockReturnValueOnce(firstPending)
      .mockResolvedValue(outcome('reconnect-needed'));
    const { service } = setup({ ensurePat: ensure });

    // Start first — does NOT await yet so it's mid-flight
    const first = service.handleBearerCaptured();
    // Start second immediately while first is in flight
    const second = service.handleBearerCaptured();
    // Let both settle
    resolveFirst(outcome('reconnect-needed'));
    await first;
    await second;

    expect(ensure).toHaveBeenCalledTimes(1);
    expect(ensure).toHaveBeenCalledWith({ organization: 'myorg', force: true });
  });

  it('attempts again on a later trigger once the previous one has settled', async () => {
    // Each reliable trigger (a DevOps tab finishing load) is eligible for one
    // attempt; pacing across loads is the rotate throttle inside ensurePat, not a
    // one-shot in-memory flag. See ADR 0002.
    const ensure = vi.fn().mockResolvedValue(outcome('reconnect-needed'));
    const { service, broadcasts } = setup({ ensurePat: ensure });

    await service.handleBearerCaptured(); // trigger 1 fails → awaitingManualRetry
    await service.handleBearerCaptured(); // trigger 2 attempts again

    expect(ensure).toHaveBeenCalledTimes(2);
    expect(broadcasts.at(-1)).toMatchObject({ status: 'reconnect-needed' });
  });

  it('shows manual Retry after an automatic rotation fails', async () => {
    const { service, broadcasts } = setup({
      ensurePat: vi.fn().mockResolvedValue(outcome('reconnect-needed'))
    });

    await service.handleBearerCaptured();

    expect(broadcasts.at(-1)).toEqual({
      status: 'reconnect-needed',
      awaitingManualRetry: true
    });
  });

  it('clears recovery state when a rotation succeeds', async () => {
    const ensure = vi
      .fn()
      .mockResolvedValueOnce(outcome('reconnect-needed')) // auto attempt fails
      .mockResolvedValueOnce(outcome('connected')); // manual retry succeeds
    const { service, broadcasts } = setup({ ensurePat: ensure });

    await service.handleBearerCaptured();
    const status = await service.retry('myorg');

    expect(status).toBe('connected');
    expect(broadcasts.at(-1)).toEqual({
      status: 'connected',
      awaitingManualRetry: false
    });
  });

  it('bypasses the rotate throttle on both auto-recovery and manual retry', async () => {
    // Recovery is a deliberate, reliable signal; force:true bypasses the throttle
    // so a genuine reconnect is never blocked by a recent lazy ensure (ADR 0002).
    const ensure = vi.fn().mockResolvedValue(outcome('reconnect-needed'));
    const { service } = setup({ ensurePat: ensure });

    await service.handleBearerCaptured(); // auto-recovery
    await service.retry('myorg'); // manual retry

    expect(ensure).toHaveBeenNthCalledWith(1, {
      organization: 'myorg',
      force: true
    });
    expect(ensure).toHaveBeenNthCalledWith(2, {
      organization: 'myorg',
      force: true
    });
  });

  it('does not auto-recover when already connected', async () => {
    const ensure = vi.fn();
    const { service } = setup({
      ensurePat: ensure,
      getConnectionStatus: vi.fn().mockResolvedValue('connected')
    });

    await service.handleBearerCaptured();

    expect(ensure).not.toHaveBeenCalled();
  });

  it('clears a stale awaitingManualRetry once a background mint has reconnected', async () => {
    // A failed auto attempt sets awaitingManualRetry; if an authFetch 401-retry then
    // mints successfully in the background, the next trigger sees 'connected' and
    // must clear the stale manual-Retry state without minting again.
    const ensure = vi.fn().mockResolvedValue(outcome('reconnect-needed'));
    const status = vi
      .fn()
      .mockResolvedValueOnce('reconnect-needed') // first trigger: disconnected
      .mockResolvedValueOnce('connected'); // second trigger: already recovered
    const { service, broadcasts } = setup({
      ensurePat: ensure,
      getConnectionStatus: status
    });

    await service.handleBearerCaptured(); // fails → awaitingManualRetry = true
    await service.handleBearerCaptured(); // sees connected → no mint

    // The connected trigger neither mints again nor broadcasts a fresh status; it
    // just clears the stale flag so the next disconnected episode starts clean.
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(broadcasts).toHaveLength(1);
  });

  it('asks for manual Retry when no organization can be resolved', async () => {
    const ensure = vi.fn();
    const { service, broadcasts } = setup({
      ensurePat: ensure,
      resolveOrganization: vi.fn().mockResolvedValue(null)
    });

    await service.handleBearerCaptured();

    expect(ensure).not.toHaveBeenCalled();
    expect(broadcasts.at(-1)).toEqual({
      status: 'reconnect-needed',
      awaitingManualRetry: true
    });
  });
});
