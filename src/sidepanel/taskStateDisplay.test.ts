import { abbreviateTaskState, getTaskStateTone } from './taskStateDisplay';

// Every Azure DevOps state a task in this project can realistically be in.
const REALISTIC_STATES = [
  'New',
  'To Do',
  'Active',
  'In Progress',
  'Committed',
  'Completed',
  'Resolved',
  'Removed',
  'Done',
  'Doing',
  'Closed',
  'Blocked',
  'Proposed',
  'Approved',
  'Cut',
  'Code Review'
];

describe('abbreviateTaskState', () => {
  it('gives every realistic state a distinct code', () => {
    const byCode = new Map<string, string[]>();
    for (const state of REALISTIC_STATES) {
      const code = abbreviateTaskState(state);
      byCode.set(code, [...(byCode.get(code) ?? []), state]);
    }

    const collisions = [...byCode.entries()].filter(
      ([, states]) => states.length > 1
    );
    expect(collisions).toEqual([]);
  });

  it('keeps every code to two letters', () => {
    for (const state of REALISTIC_STATES) {
      expect(abbreviateTaskState(state)).toHaveLength(2);
    }
  });

  it('separates the pairs the generic rule collapses', () => {
    // These also share a tone, so the code is the only thing left to tell them
    // apart.
    expect(getTaskStateTone('Resolved')).toBe(getTaskStateTone('Removed'));
    expect(abbreviateTaskState('Resolved')).not.toBe(
      abbreviateTaskState('Removed')
    );

    expect(abbreviateTaskState('Done')).not.toBe(abbreviateTaskState('Doing'));
    expect(abbreviateTaskState('Committed')).not.toBe(
      abbreviateTaskState('Completed')
    );
  });

  it('falls back to initials for an unknown multi-word state', () => {
    expect(abbreviateTaskState('Code Review')).toBe('CR');
  });

  it('does not throw on an empty state', () => {
    expect(abbreviateTaskState('   ')).toBe('?');
  });
});
