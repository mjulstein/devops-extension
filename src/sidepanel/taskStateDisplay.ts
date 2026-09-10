// State codes for the pairs the generic rule cannot separate. Taking the first
// two letters collapses Committed/Completed, Resolved/Removed and Done/Doing —
// and the first two of those also share a colour, so nothing would tell them
// apart. A short code is only useful while it stays unambiguous.
const STATE_CODE_OVERRIDES: Record<string, string> = {
  committed: 'CM',
  completed: 'CP',
  resolved: 'RS',
  removed: 'RM',
  done: 'DN',
  doing: 'DG'
};

export function abbreviateTaskState(state: string): string {
  const override = STATE_CODE_OVERRIDES[state.trim().toLowerCase()];
  if (override) {
    return override;
  }

  const parts = state.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export type TaskStateTone =
  | 'todo'
  | 'in-progress'
  | 'done'
  | 'blocked'
  | 'unknown';

export function getTaskStateTone(state: string): TaskStateTone {
  const normalizedState = state.trim().toLowerCase();

  if (!normalizedState) {
    return 'unknown';
  }

  if (['to do', 'new', 'proposed'].includes(normalizedState)) {
    return 'todo';
  }

  if (
    ['done', 'closed', 'completed', 'resolved', 'removed'].includes(
      normalizedState
    )
  ) {
    return 'done';
  }

  if (
    ['active', 'in progress', 'committed', 'approved'].includes(normalizedState)
  ) {
    return 'in-progress';
  }

  if (['blocked', 'cut'].includes(normalizedState)) {
    return 'blocked';
  }

  return 'unknown';
}
