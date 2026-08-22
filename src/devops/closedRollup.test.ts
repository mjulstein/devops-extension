import type { WorkItem } from '@/types';
import {
  collectClosedRollupCandidates,
  isTopLevelClosedType
} from './workItems';

function item(
  id: number,
  workItemType: string,
  parentId: number | null,
  closedDate: string | null = '2026-08-21T10:00:00.000Z'
): WorkItem {
  return {
    id,
    workItemType,
    title: `Item ${id}`,
    state: 'Closed',
    assignedTo: 'Dev',
    parentId,
    parent: null,
    closedDate,
    lastChangedDate: closedDate,
    url: `https://example.invalid/${id}`
  };
}

describe('isTopLevelClosedType', () => {
  it('accepts the deliverable types', () => {
    for (const type of [
      'Improvement',
      'Bug',
      'Product Backlog Item',
      'PBI',
      '  bug  '
    ]) {
      expect(isTopLevelClosedType(type)).toBe(true);
    }
  });

  // A Feature spans many releases; rolling up to it would report the whole
  // programme as finished because one task under it closed.
  it('rejects Feature and Epic', () => {
    expect(isTopLevelClosedType('Feature')).toBe(false);
    expect(isTopLevelClosedType('Epic')).toBe(false);
  });

  it('rejects Task', () => {
    expect(isTopLevelClosedType('Task')).toBe(false);
  });
});

describe('collectClosedRollupCandidates', () => {
  it('keeps a closed deliverable as its own candidate, not its Feature parent', () => {
    const { candidateIds } = collectClosedRollupCandidates([
      item(500, 'Improvement', 9000)
    ]);

    expect(candidateIds).toEqual([500]);
  });

  it('represents a closed task by its parent', () => {
    const { candidateIds } = collectClosedRollupCandidates([
      item(501, 'Task', 700)
    ]);

    expect(candidateIds).toEqual([700]);
  });

  it('drops a parentless closed task', () => {
    const { candidateIds } = collectClosedRollupCandidates([
      item(502, 'Task', null)
    ]);

    expect(candidateIds).toEqual([]);
  });

  it('de-duplicates candidates', () => {
    const { candidateIds } = collectClosedRollupCandidates([
      item(1, 'Task', 700),
      item(2, 'Task', 700),
      item(700, 'Bug', 9000)
    ]);

    expect(candidateIds).toEqual([700]);
  });

  it('tracks the latest closed child date per parent', () => {
    const { latestChildClosedById } = collectClosedRollupCandidates([
      item(1, 'Task', 700, '2026-08-19T10:00:00.000Z'),
      item(2, 'Task', 700, '2026-08-21T10:00:00.000Z'),
      item(3, 'Task', 700, '2026-08-20T10:00:00.000Z')
    ]);

    expect(latestChildClosedById.get(700)).toBe('2026-08-21T10:00:00.000Z');
  });

  it('ignores a child with no closed date when dating the parent', () => {
    const { latestChildClosedById } = collectClosedRollupCandidates([
      item(1, 'Task', 700, null)
    ]);

    expect(latestChildClosedById.has(700)).toBe(false);
  });

  it('returns nothing for an empty list', () => {
    expect(collectClosedRollupCandidates([])).toEqual({
      candidateIds: [],
      latestChildClosedById: new Map()
    });
  });
});
