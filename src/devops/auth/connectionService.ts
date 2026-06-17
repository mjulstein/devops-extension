import { ensurePat, type EnsurePatOutcome } from './ensurePat';
import { getConnectionStatus, type ConnectionStatus } from './connectionStatus';

// Owns the small amount of state the reconnect flow needs that is NOT derivable
// from PAT validity: whether a recovery is currently in flight (so near-simultaneous
// triggers don't double-mint), and whether the side panel should offer a manual
// Retry. Kept in the adapter so the service worker stays a generic router (FR-010).
//
// Recovery is pull-driven: the service worker calls handleBearerCaptured() whenever
// an Azure DevOps tab finishes loading while disconnected (and, as a best-effort
// fast path, on the relayed bearer-captured signal). It's a deliberate, reliable
// signal, so it bypasses the rotate throttle (like the original auto-recovery).
// Storms are prevented structurally instead: the in-flight latch blocks concurrent
// triggers, and a successful mint flips us to 'connected' so further tab-loads
// no-op until the next expiry. See docs/adr/0002-pull-driven-reconnect-recovery.md.

export interface ConnectionBroadcast {
  status: ConnectionStatus;
  // True once the one automatic recovery has failed: the panel shows manual Retry.
  awaitingManualRetry: boolean;
}

export interface ConnectionServiceDeps {
  ensurePat: (options: {
    organization: string;
    force?: boolean;
  }) => Promise<EnsurePatOutcome>;
  getConnectionStatus: () => Promise<ConnectionStatus>;
  // Resolves the org for an auto-recovery triggered by a captured Bearer (no
  // side-panel context to carry one). Null when none is known yet.
  resolveOrganization: () => Promise<string | null>;
  broadcast: (payload: ConnectionBroadcast) => void;
  debug?: (message: string) => void;
}

export interface ConnectionService {
  // Lazy ensure-valid: side panel open / before a data op (FR-005).
  ensure(organization: string): Promise<ConnectionStatus>;
  // Manual Retry control (FR-008): a deliberate forced rotation.
  retry(organization: string): Promise<ConnectionStatus>;
  // Relayed fresh-Bearer capture: attempt exactly one automatic rotation.
  handleBearerCaptured(): Promise<void>;
}

export function createConnectionService(
  deps: ConnectionServiceDeps
): ConnectionService {
  // True only while a recovery rotation is awaiting, so near-simultaneous triggers
  // (e.g. several DevOps tabs finishing at once) don't each start a mint before the
  // first writes its throttle timestamp. NOT a one-shot: each fresh trigger is
  // eligible once the previous attempt settles.
  let recoveryInFlight = false;
  let awaitingManualRetry = false;

  function settle(status: ConnectionStatus): ConnectionStatus {
    if (status === 'connected') {
      awaitingManualRetry = false;
    }
    deps.broadcast({ status, awaitingManualRetry });
    return status;
  }

  async function rotate(organization: string): Promise<ConnectionStatus> {
    // force:true also bypasses the rotate throttle — recovery and manual Retry are
    // both deliberate, immediate attempts (ADR 0002). The lazy `ensure` path keeps
    // respecting the throttle.
    const outcome = await deps.ensurePat({ organization, force: true });
    deps.debug?.(
      `rotate: ensurePat=${outcome.status}${outcome.mintError ? ` err="${outcome.mintError}"` : ''}`
    );
    if (outcome.status === 'reconnect-needed') {
      awaitingManualRetry = true;
    }
    return settle(outcome.status);
  }

  return {
    async ensure(organization) {
      const outcome = await deps.ensurePat({ organization });
      return settle(outcome.status);
    },

    async retry(organization) {
      return rotate(organization);
    },

    async handleBearerCaptured() {
      const status = await deps.getConnectionStatus();
      deps.debug?.(
        `recover: status=${status} awaitingRetry=${awaitingManualRetry} inFlight=${recoveryInFlight}`
      );
      if (status === 'connected') {
        // A background mint (e.g. an authFetch 401 retry) already recovered us.
        awaitingManualRetry = false;
        return;
      }
      if (recoveryInFlight) {
        deps.debug?.('recover: skipping (a rotation is already in flight)');
        return;
      }
      // Latch synchronously before the next await so a concurrent trigger bails.
      recoveryInFlight = true;
      try {
        const organization = await deps.resolveOrganization();
        deps.debug?.(`recover: org=${organization ?? '(none)'}`);
        if (!organization) {
          awaitingManualRetry = true;
          deps.broadcast({ status: 'reconnect-needed', awaitingManualRetry });
          return;
        }
        await rotate(organization);
      } finally {
        recoveryInFlight = false;
      }
    }
  };
}

// Default service wired to the real adapter + chrome broadcast. resolveOrganization
// is injected by the service worker (it owns last-visited context).
export function createDefaultConnectionService(
  resolveOrganization: () => Promise<string | null>,
  debug?: (message: string) => void
): ConnectionService {
  return createConnectionService({
    ensurePat,
    getConnectionStatus,
    resolveOrganization,
    broadcast: (payload) => {
      void chrome.runtime
        .sendMessage({ type: 'CONNECTION_STATUS', payload })
        .catch(() => undefined);
    },
    debug
  });
}
