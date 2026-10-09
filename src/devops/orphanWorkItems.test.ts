import {
  checkBulkParent,
  describeParentMismatch,
  parentlessByDesign,
  selectOrphans,
  type OrphanCandidate
} from './orphanWorkItems';

function candidate(
  id: number,
  workItemType: string,
  parentId: number | null = null
): OrphanCandidate {
  return {
    id,
    title: `Item ${id}`,
    workItemType,
    state: 'New',
    parentId,
    url: `https://dev.azure.test/o/p/_workitems/edit/${id}`
  };
}

describe('describeParentMismatch', () => {
  it('lets a task go under a bug, backlog item or improvement', () => {
    for (const parent of ['Bug', 'Product Backlog Item', 'Improvement']) {
      expect(describeParentMismatch('Task', parent)).toBeNull();
    }
  });

  it('refuses a task under a feature', () => {
    expect(describeParentMismatch('Task', 'Feature')).toContain(
      'A Task goes under a Bug'
    );
  });

  it('lets a bug, backlog item or improvement go under a feature', () => {
    for (const child of ['Bug', 'Product Backlog Item', 'Improvement']) {
      expect(describeParentMismatch(child, 'Feature')).toBeNull();
    }
  });

  it('refuses a bug under another bug', () => {
    expect(describeParentMismatch('Bug', 'Bug')).toContain(
      'A Bug goes under a Feature'
    );
  });

  it('says so for a type it does not handle', () => {
    expect(describeParentMismatch('Epic', 'Feature')).toContain(
      'not one this view knows how to parent'
    );
  });
});

describe('selectOrphans', () => {
  it('keeps only the ones with no parent', () => {
    expect(
      selectOrphans([candidate(1, 'Bug'), candidate(2, 'Bug', 9)], []).map(
        (c) => c.id
      )
    ).toEqual([1]);
  });

  it('leaves out the ones that are parentless on purpose', () => {
    // The quick-task holder has nowhere to belong by design.
    expect(
      selectOrphans(
        [candidate(1, 'Bug'), candidate(61187, 'Bug')],
        [61187]
      ).map((c) => c.id)
    ).toEqual([1]);
  });
});

describe('parentlessByDesign', () => {
  it('reads the two holders out of settings', () => {
    expect(
      parentlessByDesign({
        quickTaskParentId: ' 101 ',
        quickTaskArchiveId: '202'
      })
    ).toEqual([101, 202]);
  });

  it('ignores the ones that are not set', () => {
    expect(
      parentlessByDesign({
        quickTaskParentId: '',
        quickTaskArchiveId: 'nonsense'
      })
    ).toEqual([]);
  });
});

describe('checkBulkParent', () => {
  const candidates = [
    candidate(1, 'Bug'),
    candidate(2, 'Task'),
    candidate(3, 'Improvement')
  ];

  it('takes the ones the hierarchy allows and explains the rest', () => {
    const result = checkBulkParent(
      { ids: [1, 2, 3], candidates },
      500,
      'Feature'
    );
    expect(result.allowed).toEqual([1, 3]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]).toMatchObject({ id: 2 });
    expect(result.refused[0].reason).toContain('#500');
  });

  it('parents tasks under a backlog item, and refuses the others', () => {
    const result = checkBulkParent({ ids: [1, 2], candidates }, 500, 'Bug');
    expect(result.allowed).toEqual([2]);
    expect(result.refused.map((r) => r.id)).toEqual([1]);
  });

  it('refuses an item asked to be its own parent', () => {
    const result = checkBulkParent({ ids: [1], candidates }, 1, 'Feature');
    expect(result.allowed).toEqual([]);
    expect(result.refused[0].reason).toContain('its own parent');
  });

  it('ignores a ticked id that is not on offer any more', () => {
    const result = checkBulkParent({ ids: [99], candidates }, 500, 'Feature');
    expect(result).toEqual({ allowed: [], refused: [] });
  });
});
