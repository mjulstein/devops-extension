import { parseBatch } from './inProgressByMeApi';

describe('parseBatch', () => {
  const payload = {
    value: [
      {
        id: 7,
        fields: {
          'System.Title': 'Do the thing',
          'System.WorkItemType': 'Task',
          'System.TeamProject': 'My Project',
          'System.AssignedTo': { uniqueName: 'other@example.test' }
        }
      }
    ]
  };

  it('reads the fields the lists show', () => {
    expect(parseBatch(payload, 'my-org')[0]).toEqual({
      id: 7,
      title: 'Do the thing',
      workItemType: 'Task',
      project: 'My Project',
      assignedTo: 'other@example.test',
      url: 'https://dev.azure.com/my-org/My%20Project/_workitems/edit/7'
    });
  });

  it('builds the address from the item own project, not a configured one', () => {
    // The queries can cross projects, so the row has to link to its own.
    expect(parseBatch(payload, 'org')[0].url).toContain('/My%20Project/');
  });

  it('reads an unassigned item as having nobody', () => {
    const unassigned = { value: [{ id: 1, fields: { 'System.Title': 'X' } }] };
    expect(parseBatch(unassigned, 'org')[0].assignedTo).toBe('');
  });

  it('survives a response that is not what was expected', () => {
    expect(parseBatch(null, 'org')).toEqual([]);
    expect(parseBatch({ value: [{ no: 'fields' }] }, 'org')).toEqual([]);
  });
});
