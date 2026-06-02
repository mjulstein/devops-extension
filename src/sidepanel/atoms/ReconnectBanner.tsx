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
        border: '1px solid #f0b8b8',
        background: '#fdecec',
        borderRadius: 6,
        padding: '10px 12px',
        margin: '8px 0',
        fontSize: 13,
        color: '#7a1f1f'
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Reconnect needed</div>
      <div style={{ marginBottom: 8 }}>
        The Azure DevOps session is unavailable, so data actions are paused.
        Open Azure DevOps in a new tab and complete any sign-in; the panel
        recovers automatically once you are signed in.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onReconnect}>
          Open Azure DevOps{organization ? ` (${organization})` : ''} to
          reconnect
        </button>
        {awaitingManualRetry && <button onClick={onRetry}>Retry</button>}
      </div>
    </div>
  );
}
