import { Button } from './Button';
interface ReconnectBannerProps {
  organization: string;
  awaitingManualRetry: boolean;
  onReconnect: () => void;
  onRetry: () => void;
}

// Shown when the connection status is **Reconnect needed**: all data actions are
// blocked elsewhere; this offers the recovery affordances (spec US-2 / FR-007/008).
export function ReconnectBanner({
  organization,
  awaitingManualRetry,
  onReconnect,
  onRetry
}: ReconnectBannerProps) {
  return (
    <div
      role="alert"
      style={{
        border: '1px solid var(--color-danger)',
        background: 'var(--color-danger-surface)',
        borderRadius: 6,
        padding: '10px 12px',
        margin: '8px 0',
        fontSize: 13,
        color: 'var(--color-danger)'
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Reconnect needed</div>
      <div style={{ marginBottom: 8 }}>
        The Azure DevOps session is unavailable, so data actions are paused.
        Open Azure DevOps in a new tab and complete any sign-in; the panel
        recovers automatically once you are signed in.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={onReconnect}>
          Open Azure DevOps{organization ? ` (${organization})` : ''} to
          reconnect
        </Button>
        {awaitingManualRetry && (
          <Button
            onClick={onRetry}
            description="Try the connection again without leaving the panel"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
