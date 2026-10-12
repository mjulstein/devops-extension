import {
  buildAssignedWiql,
  buildStartedForOthersWiql,
  identityClause,
  wasMovedToStateBy
} from './inProgressByMe';

describe('identityClause', () => {
  it('keeps the user out of the query when nothing is saved', () => {
    expect(identityClause('')).toBe('@Me');
    expect(identityClause('   ')).toBe('@Me');
  });

  it('uses a saved override as given', () => {
    expect(identityClause('someone@example.test')).toBe(
      "'someone@example.test'"
    );
  });

  it('escapes a quote rather than breaking the query', () => {
    expect(identityClause("o'brien@example.test")).toBe(
      "'o''brien@example.test'"
    );
  });
});

describe('the two queries', () => {
  it('asks for what is in the state and mine', () => {
    const wiql = buildAssignedWiql('In Progress', '');
    expect(wiql).toContain("[System.State] = 'In Progress'");
    expect(wiql).toContain('[System.AssignedTo] = @Me');
  });

  it('asks for what is in the state, not mine, and once touched by me', () => {
    const wiql = buildStartedForOthersWiql('Active', '');
    expect(wiql).toContain('[System.AssignedTo] <> @Me');
    expect(wiql).toContain('[System.ChangedBy] EVER @Me');
  });

  it('escapes a state name with a quote in it', () => {
    expect(buildAssignedWiql("In Progress's", '')).toContain(
      "'In Progress''s'"
    );
  });
});

describe('wasMovedToStateBy', () => {
  const update = (newValue: string, uniqueName: string) => ({
    fields: { 'System.State': { newValue } },
    revisedBy: { uniqueName }
  });

  it('confirms the user moving it into the state', () => {
    expect(
      wasMovedToStateBy(
        [update('In Progress', 'me@example.test')],
        'In Progress',
        'me@example.test'
      )
    ).toBe(true);
  });

  it('refuses somebody else making the same move', () => {
    expect(
      wasMovedToStateBy(
        [update('In Progress', 'other@example.test')],
        'In Progress',
        'me@example.test'
      )
    ).toBe(false);
  });

  it('refuses the user making some other change', () => {
    // Editing the title afterwards is not starting the work.
    expect(
      wasMovedToStateBy(
        [
          {
            fields: { 'System.Title': { newValue: 'Renamed' } },
            revisedBy: { uniqueName: 'me@example.test' }
          }
        ],
        'In Progress',
        'me@example.test'
      )
    ).toBe(false);
  });

  it('refuses a move into a different state', () => {
    expect(
      wasMovedToStateBy(
        [update('Done', 'me@example.test')],
        'In Progress',
        'me@example.test'
      )
    ).toBe(false);
  });

  it('says no when there is no identity to compare against', () => {
    expect(
      wasMovedToStateBy(
        [update('In Progress', 'me@example.test')],
        'In Progress',
        ''
      )
    ).toBe(false);
  });

  it('survives a response that is not a list of updates', () => {
    expect(wasMovedToStateBy(null, 'In Progress', 'me@example.test')).toBe(
      false
    );
    expect(
      wasMovedToStateBy([null, 42], 'In Progress', 'me@example.test')
    ).toBe(false);
  });
});
