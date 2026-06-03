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
  it('blocks a mid-flight second capture while the first rotation is in progress', async () => {
    // Simulate two concurrent handleBearerCaptured calls — the second should not
    // start a rotation because autoRecoveryAttempted is set before the first awaits.
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

  it('re-arms auto-recovery when a new distinct bearer is captured while awaitingManualRetry', async () => {
    // Simulates: PAT expired → auto-recovery fires and fails → user visits DevOps
    // and a new distinct bearer is captured. We want auto-recovery to fire again.
    const ensure = vi.fn().mockResolvedValue(outcome('reconnect-needed'));
    const { service, broadcasts } = setup({ ensurePat: ensure });

    await service.handleBearerCaptured(); // attempt 1 fails → awaitingManualRetry
    await service.handleBearerCaptured(); // new distinct bearer → should retry

    expect(ensure).toHaveBeenCalledTimes(2);
    expect(broadcasts.at(-1)).toMatchObject({ status: 'reconnect-needed' });
  });

  it('shows manual Retry after the one automatic rotation fails', async () => {
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

  it('re-arms the automatic path after a successful manual retry', async () => {
    const ensure = vi
      .fn()
      .mockResolvedValueOnce(outcome('reconnect-needed')) // auto fails
      .mockResolvedValueOnce(outcome('connected')) // manual retry succeeds
      .mockResolvedValueOnce(outcome('connected')); // next auto capture
    const { service } = setup({
      ensurePat: ensure,
      // After the retry succeeds we are connected; a later drop re-arms auto.
      getConnectionStatus: vi.fn().mockResolvedValue('reconnect-needed')
    });

    await service.handleBearerCaptured(); // attempt 1 (fails)
    await service.retry('myorg'); // success -> re-arm
    await service.handleBearerCaptured(); // attempt 2 allowed again

    expect(ensure).toHaveBeenCalledTimes(3);
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
