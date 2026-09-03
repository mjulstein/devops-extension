import type { ReactNode } from 'react';
import classes from './SettingsCard.module.css';

interface SettingsHelpProps {
  summary: string;
  children: ReactNode;
}

/**
 * Collapsed explanation. Settings needs the detail available but not in the way:
 * at panel width, a paragraph per field pushes the inputs off screen.
 */
export function SettingsHelp({ summary, children }: SettingsHelpProps) {
  return (
    <details className={classes.help}>
      <summary className={classes.helpSummary}>{summary}</summary>
      <div className={classes.helpBody}>{children}</div>
    </details>
  );
}
