import { parseCandidates } from './orphanWorkItemsApi';

describe('parseCandidates', () => {
  const payload = {
    value: [
      {
        id: 1,
        fields: {
          'System.Title': 'A bug',
          'System.WorkItemType': 'Bug',
          'System.State': 'New'
        }
      },
      {
        id: 2,
        fields: {
          'System.Title': 'Parented already',
          'System.WorkItemType': 'Task',
          'System.State': 'Active',
          'System.Parent': 99
        }
      }
    ]
  };

  it('reads an item with no parent field as parentless', () => {
    const [first] = parseCandidates(payload, 'org', 'proj');
    expect(first).toEqual({
      id: 1,
      title: 'A bug',
      workItemType: 'Bug',
      state: 'New',
      parentId: null,
      url: 'https://dev.azure.com/org/proj/_workitems/edit/1'
    });
  });

  it('keeps the parent when there is one, so it can be filtered out later', () => {
    expect(parseCandidates(payload, 'org', 'proj')[1].parentId).toBe(99);
  });

  it('builds the address from the organization and project it is given', () => {
    expect(parseCandidates(payload, 'my org', 'my proj')[0].url).toBe(
      'https://dev.azure.com/my%20org/my%20proj/_workitems/edit/1'
    );
  });

  it('survives a response that is not what was expected', () => {
    expect(parseCandidates(null, 'o', 'p')).toEqual([]);
    expect(parseCandidates({ value: [{ nope: true }] }, 'o', 'p')).toEqual([]);
  });
});
