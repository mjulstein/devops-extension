export interface DebugLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'error';
  message: string;
}

interface DebugConsolePaneProps {
  entries: DebugLogEntry[];
  onClear: () => void;
}

export function DebugConsolePane({ entries, onClear }: DebugConsolePaneProps) {
  return (
    <section className="card debug-console">
      <div className="debug-console-header">
        <h3>Developer console</h3>
        <button
          type="button"
          className="debug-console-clear"
          onClick={onClear}
          disabled={!entries.length}
        >
          Clear
        </button>
      </div>

      <div className="debug-console-list" role="log" aria-live="polite">
        {entries.length ? (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`debug-console-entry ${entry.level}`}
            >
              <span className="debug-console-time">
                {formatTimestamp(entry.timestamp)}
              </span>
              <span className="debug-console-message">{entry.message}</span>
            </div>
          ))
        ) : (
          <div className="debug-console-empty">No logs yet.</div>
        )}
      </div>
    </section>
  );
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleTimeString();
}
