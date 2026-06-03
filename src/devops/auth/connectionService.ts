import { ensurePat, type EnsurePatOutcome } from './ensurePat';
import {
  getConnectionStatus,
  shouldAttemptAutoRecovery,
  type ConnectionStatus
} from './connectionStatus';

// Owns the small amount of state the reconnect flow needs that is NOT derivable
// from PAT validity: whether the single automatic rotation has been spent, and
// whether the side panel should now offer a manual Retry. Kept in the adapter so
// the service worker stays a generic router (FR-010).

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
  let autoRecoveryAttempted = false;
  let awaitingManualRetry = false;

  function reset(): void {
    autoRecoveryAttempted = false;
    awaitingManualRetry = false;
  }

  function settle(status: ConnectionStatus): ConnectionStatus {
    if (status === 'connected') {
      reset();
    }
    deps.broadcast({ status, awaitingManualRetry });
    return status;
  }

  async function rotate(organization: string): Promise<ConnectionStatus> {
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
      // A manual Retry re-arms the automatic path for the next capture cycle.
      autoRecoveryAttempted = false;
      return rotate(organization);
    },

    async handleBearerCaptured() {
      const status = await deps.getConnectionStatus();
      deps.debug?.(
        `bearer-captured: status=${status} awaitingRetry=${awaitingManualRetry} attempted=${autoRecoveryAttempted}`
      );
      // When the user is actively waiting to reconnect, a new distinct bearer
      // capture likely means they just signed in — re-arm the auto-recovery so
      // this attempt is not blocked by a previous failed rotation.
      if (awaitingManualRetry) {
        autoRecoveryAttempted = false;
      }
      if (!shouldAttemptAutoRecovery(status, autoRecoveryAttempted)) {
        deps.debug?.(
          'bearer-captured: skipping (connected or already attempted)'
        );
        return;
      }
      // Spend the single automatic attempt up front so a second capture mid-flight
      // cannot fire another.
      autoRecoveryAttempted = true;

      const organization = await deps.resolveOrganization();
      deps.debug?.(`bearer-captured: org=${organization ?? '(none)'}`);
      if (!organization) {
        awaitingManualRetry = true;
        deps.broadcast({ status: 'reconnect-needed', awaitingManualRetry });
        return;
      }
      await rotate(organization);
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
