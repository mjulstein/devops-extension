import {
  buildQuickTaskDescription,
  buildQuickTaskTitle,
  pickInProgressState
} from './quickTask';
import { parseIdentity } from './identity';

describe('buildQuickTaskTitle', () => {
  it('uses the page title, trimmed', () => {
    expect(buildQuickTaskTitle('  Refactor the thing  ')).toBe(
      'Refactor the thing'
    );
  });

  it('collapses whitespace, including newlines from a scraped title', () => {
    expect(buildQuickTaskTitle('Fix\n  the\tlayout')).toBe('Fix the layout');
  });

  it('is empty for a blank title, so the caller can refuse', () => {
    expect(buildQuickTaskTitle('   \n ')).toBe('');
  });

  // Azure DevOps rejects System.Title over 255 characters.
  it('truncates an over-long title with an ellipsis', () => {
    const title = buildQuickTaskTitle('x'.repeat(400));
    expect(title).toHaveLength(255);
    expect(title.endsWith('…')).toBe(true);
  });

  it('leaves a title at exactly the limit alone', () => {
    const exact = 'y'.repeat(255);
    expect(buildQuickTaskTitle(exact)).toBe(exact);
  });
});

describe('buildQuickTaskDescription', () => {
  it('links back to the page', () => {
    expect(
      buildQuickTaskDescription('Some page', 'https://example.invalid/a?b=1')
    ).toBe('<div><a href="https://example.invalid/a?b=1">Some page</a></div>');
  });

  // System.Description is HTML and a page title is arbitrary text from an
  // arbitrary site, so both href and label must be escaped.
  it('escapes HTML in the title', () => {
    expect(
      buildQuickTaskDescription(
        '<script>alert(1)</script>',
        'https://x.invalid'
      )
    ).toBe(
      '<div><a href="https://x.invalid">&lt;script&gt;alert(1)&lt;/script&gt;</a></div>'
    );
  });

  it('escapes quotes and ampersands in the url', () => {
    expect(buildQuickTaskDescription('t', 'https://x.invalid/?a=1&b="2"')).toBe(
      '<div><a href="https://x.invalid/?a=1&amp;b=&quot;2&quot;">t</a></div>'
    );
  });

  it('falls back to the url as link text when there is no title', () => {
    expect(buildQuickTaskDescription('', 'https://x.invalid')).toBe(
      '<div><a href="https://x.invalid">https://x.invalid</a></div>'
    );
  });

  it('is empty without a url, so no empty link is written', () => {
    expect(buildQuickTaskDescription('Title', '  ')).toBe('');
  });
});

describe('parseIdentity', () => {
  const payload = {
    authenticatedUser: {
      id: 'ea65b156-52af-6953-9838-0039bb53ad32',
      providerDisplayName: 'Dev User',
      properties: {
        Account: { $type: 'System.String', $value: 'dev@example.invalid' }
      }
    }
  };

  // properties.Account.$value is what System.AssignedTo accepts.
  it('reads the id, display name and account name', () => {
    expect(parseIdentity(payload)).toEqual({
      id: 'ea65b156-52af-6953-9838-0039bb53ad32',
      displayName: 'Dev User',
      uniqueName: 'dev@example.invalid'
    });
  });

  it('tolerates a missing account property', () => {
    expect(
      parseIdentity({
        authenticatedUser: { id: 'abc', providerDisplayName: 'X' }
      })
    ).toEqual({ id: 'abc', displayName: 'X', uniqueName: '' });
  });

  it('returns null without an id', () => {
    expect(
      parseIdentity({ authenticatedUser: { providerDisplayName: 'X' } })
    ).toBeNull();
    expect(parseIdentity({})).toBeNull();
    expect(parseIdentity(null)).toBeNull();
  });
});

describe('pickInProgressState', () => {
  // The state is discovered by category so a process that renames its
  // in-progress state still works.
  const scrumStates = [
    { name: 'To Do', category: 'Proposed' },
    { name: 'In Progress', category: 'InProgress' },
    { name: 'Done', category: 'Completed' },
    { name: 'Removed', category: 'Removed' }
  ];

  it('picks the InProgress-category state', () => {
    expect(pickInProgressState(scrumStates)).toBe('In Progress');
  });

  it('picks a differently named state in the same category', () => {
    expect(
      pickInProgressState([
        { name: 'New', category: 'Proposed' },
        { name: 'Active', category: 'InProgress' }
      ])
    ).toBe('Active');
  });

  it('returns null when no state is in progress', () => {
    expect(
      pickInProgressState([{ name: 'New', category: 'Proposed' }])
    ).toBeNull();
  });

  it('tolerates malformed input', () => {
    expect(pickInProgressState(undefined)).toBeNull();
    expect(pickInProgressState([null, 3, {}])).toBeNull();
    expect(pickInProgressState([{ category: 'InProgress' }])).toBeNull();
  });
});
