import {
  addDays,
  buildActivityWiql,
  dayKey,
  emptyRangesKey,
  extractChanges,
  findLooseEnds,
  nextWindow,
  parseMinChanges,
  recordEmpty,
  summariseDay,
  workingDays,
  type ActivityChange
} from './workDay';

/** A local-time ISO stamp, so day bucketing is independent of the test machine's zone. */
function at(day: string, hour = 10): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

const me = 'user@example.com';

function update(
  rev: number,
  day: string,
  fields: Record<string, unknown> = {},
  by = me
) {
  return {
    rev,
    revisedBy: { uniqueName: by },
    fields: { 'System.ChangedDate': { newValue: at(day) }, ...fields }
  };
}

describe('day keys', () => {
  it('uses local time and crosses month ends', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('nextWindow', () => {
  it('covers fifteen days ending at the given day', () => {
    expect(nextWindow('2026-11-15', [])).toEqual({
      from: '2026-11-01',
      to: '2026-11-15'
    });
  });

  it('skips a window already known to be empty', () => {
    expect(
      nextWindow('2026-11-15', [{ from: '2026-11-01', to: '2026-11-15' }])
    ).toEqual({ from: '2026-10-17', to: '2026-10-31' });
  });

  it('stops short of an empty range inside the window', () => {
    expect(
      nextWindow('2026-11-15', [{ from: '2026-10-20', to: '2026-11-05' }])
    ).toEqual({ from: '2026-11-06', to: '2026-11-15' });
  });
});

describe('recordEmpty', () => {
  it('merges touching ranges', () => {
    expect(
      recordEmpty([{ from: '2026-11-01', to: '2026-11-15' }], {
        from: '2026-10-17',
        to: '2026-10-31'
      })
    ).toEqual([{ from: '2026-10-17', to: '2026-11-15' }]);
  });
});

describe('settings helpers', () => {
  it('falls back to 3 for unusable N', () => {
    expect(parseMinChanges('')).toBe(3);
    expect(parseMinChanges('0')).toBe(3);
    expect(parseMinChanges('5')).toBe(5);
  });

  it('keys the record on user and N', () => {
    expect(emptyRangesKey('', 3)).toBe('@me|3');
    expect(emptyRangesKey('Other@Example.com', 2)).toBe('other@example.com|2');
  });

  it('queries by the subject user', () => {
    expect(buildActivityWiql('', '2026-11-01')).toContain(
      '[System.ChangedBy] EVER @Me'
    );
    expect(buildActivityWiql("o'neil", '2026-11-01')).toContain("'o''neil'");
  });
});

describe('extractChanges', () => {
  it('keeps only the user and classifies each update', () => {
    const changes = extractChanges(
      7,
      [
        update(1, '2026-11-10', { 'System.State': { newValue: 'New' } }),
        update(2, '2026-11-10', { 'System.State': { newValue: 'Active' } }),
        update(3, '2026-11-10', { 'System.History': { newValue: 'hi' } }),
        update(4, '2026-11-10', { 'System.Title': { newValue: 't' } }),
        update(5, '2026-11-10', {}, 'someone@example.com')
      ],
      me
    );
    expect(changes.map((c) => c.kind)).toEqual([
      'created',
      'state',
      'commented',
      'edited'
    ]);
  });
});

describe('workingDays and summariseDay', () => {
  const changes: ActivityChange[] = [
    { id: 1, at: at('2026-11-10', 9), kind: 'created', state: 'New' },
    { id: 1, at: at('2026-11-10', 11), kind: 'state', state: 'Active' },
    { id: 2, at: at('2026-11-10', 12), kind: 'commented' },
    { id: 3, at: at('2026-11-14', 12), kind: 'edited' }
  ];

  it('skips days under N', () => {
    expect(
      workingDays(changes, { from: '2026-11-01', to: '2026-11-15' }, 3)
    ).toEqual(['2026-11-10']);
  });

  it('summarises per item, newest first', () => {
    const summary = summariseDay(changes, '2026-11-10');
    expect(summary.map((s) => s.id)).toEqual([2, 1]);
    expect(summary[1].actions).toEqual(['created', '→ Active']);
    expect(summary[1].movedTo).toBe('Active');
  });

  it('finds loose ends', () => {
    const summary = summariseDay(changes, '2026-11-10');
    expect(
      findLooseEnds(
        summary,
        [
          { id: 1, state: 'Active', assignedTo: me, parentId: null },
          { id: 2, state: 'Active', assignedTo: me, parentId: 9 }
        ],
        me
      )
    ).toEqual({
      stillInState: [1],
      createdWithoutParent: [1],
      handedOver: []
    });
    expect(
      findLooseEnds(
        summary,
        [{ id: 1, state: 'Active', assignedTo: 'x@example.com', parentId: 4 }],
        me
      ).handedOver
    ).toEqual([1]);
  });
});
