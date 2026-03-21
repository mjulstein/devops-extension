export function abbreviateTaskState(state: string): string {
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
