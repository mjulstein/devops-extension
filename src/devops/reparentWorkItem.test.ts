import { findParentRelation } from './reparentWorkItem';

function hierarchyReverse(id: number) {
  return {
    rel: 'System.LinkTypes.Hierarchy-Reverse',
    url: `https://dev.azure.com/o/_apis/wit/workItems/${id}`
  };
}

describe('findParentRelation', () => {
  // The index matters: removing the old parent is done by array position.
  it('returns the parent id and its index', () => {
    expect(
      findParentRelation({
        relations: [
          { rel: 'System.LinkTypes.Hierarchy-Forward', url: '.../workItems/5' },
          hierarchyReverse(900)
        ]
      })
    ).toEqual({ id: 900, index: 1 });
  });

  it('ignores child and artifact links', () => {
    expect(
      findParentRelation({
        relations: [
          { rel: 'System.LinkTypes.Hierarchy-Forward', url: '.../workItems/5' },
          { rel: 'ArtifactLink', url: 'vstfs:///Git/PullRequestId/a%2fb%2f1' }
        ]
      })
    ).toBeNull();
  });

  it('returns null when the item has no parent', () => {
    expect(findParentRelation({ relations: [] })).toBeNull();
  });

  it('tolerates malformed payloads', () => {
    expect(findParentRelation(null)).toBeNull();
    expect(findParentRelation({})).toBeNull();
    expect(findParentRelation({ relations: 'nope' })).toBeNull();
    expect(
      findParentRelation({
        relations: [{ rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'no-id' }]
      })
    ).toBeNull();
  });
});
