import clsx from 'clsx';
import classes from './DebugConsolePane.module.css';

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
    <section className={clsx(classes.card, classes.debugConsole)}>
      <div className={classes.debugConsoleHeader}>
        <h3 className={classes.heading}>Developer console</h3>
        <button
          type="button"
          className={classes.debugConsoleClear}
          onClick={onClear}
          disabled={!entries.length}
        >
          Clear
        </button>
      </div>

      <div className={classes.debugConsoleList} role="log" aria-live="polite">
        {entries.length ? (
          entries.map((entry) => (
            <div key={entry.id} className={classes.debugConsoleEntry}>
              <span className={classes.debugConsoleTime}>
                {formatTimestamp(entry.timestamp)}
              </span>
              <span
                className={clsx(
                  classes.debugConsoleMessage,
                  entry.level === 'success' && classes.successMessage,
                  entry.level === 'error' && classes.errorMessage
                )}
              >
                {entry.message}
              </span>
            </div>
          ))
        ) : (
          <div className={classes.debugConsoleEmpty}>No logs yet.</div>
        )}
      </div>
    </section>
  );
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleTimeString();
}
