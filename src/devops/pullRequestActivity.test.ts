import {
  ACTIVITY_WINDOW_MS,
  activityRank,
  isAssignedTo,
  mentionsIdentity,
  scoreInvolvement
} from './pullRequestActivity';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const NOBODY = {
  authoredByMe: false,
  commentedByMe: false,
  mentionsMe: false,
  assignedToMe: false
};

function score(overrides: Partial<Parameters<typeof scoreInvolvement>[0]>) {
  return scoreInvolvement({
    status: 'active',
    involvement: NOBODY,
    createdAt: NOW - 30 * DAY,
    closedAt: null,
    lastCommentedAt: null,
    now: NOW,
    ...overrides
  });
}

describe('scoreInvolvement', () => {
  it('excludes a pull request I have nothing to do with', () => {
    expect(score({}).include).toBe(false);
  });

  describe('authored', () => {
    it('includes an open PR I authored', () => {
      expect(
        score({ involvement: { ...NOBODY, authoredByMe: true } }).include
      ).toBe(true);
    });

    it('includes one I authored that closed inside the window', () => {
      expect(
        score({
          status: 'completed',
          involvement: { ...NOBODY, authoredByMe: true },
          closedAt: NOW - 2 * DAY
        }).include
      ).toBe(true);
    });

    // Otherwise the tab would fill with years of history.
    it('excludes one I authored that closed long ago', () => {
      expect(
        score({
          status: 'completed',
          involvement: { ...NOBODY, authoredByMe: true },
          closedAt: NOW - 60 * DAY
        }).include
      ).toBe(false);
    });
  });

  describe('commented', () => {
    it('includes any PR I commented on inside the window', () => {
      expect(
        score({
          status: 'completed',
          involvement: { ...NOBODY, commentedByMe: true },
          closedAt: NOW - 60 * DAY,
          lastCommentedAt: NOW - 3 * DAY
        }).include
      ).toBe(true);
    });

    it('excludes a closed PR whose comments are all older than the window', () => {
      expect(
        score({
          status: 'abandoned',
          involvement: { ...NOBODY, commentedByMe: true },
          closedAt: NOW - 60 * DAY,
          lastCommentedAt: NOW - 60 * DAY
        }).include
      ).toBe(false);
    });

    // An open PR I once commented on is still mine to follow.
    it('includes an open PR I commented on long ago', () => {
      expect(
        score({
          involvement: { ...NOBODY, commentedByMe: true },
          lastCommentedAt: NOW - 90 * DAY
        }).include
      ).toBe(true);
    });
  });

  describe('mentioned', () => {
    it('includes an open PR that mentions me even with no comment of mine', () => {
      expect(
        score({ involvement: { ...NOBODY, mentionsMe: true } }).include
      ).toBe(true);
    });

    it('excludes a closed PR that merely mentions me', () => {
      expect(
        score({
          status: 'completed',
          involvement: { ...NOBODY, mentionsMe: true },
          closedAt: NOW - 2 * DAY
        }).include
      ).toBe(false);
    });
  });

  describe('ranking', () => {
    it('ranks by my latest comment when that is freshest', () => {
      expect(
        score({
          involvement: { ...NOBODY, commentedByMe: true },
          lastCommentedAt: NOW - DAY
        }).lastActivityAt
      ).toBe(NOW - DAY);
    });

    it('falls back to creation time for an untouched authored PR', () => {
      expect(
        score({
          involvement: { ...NOBODY, authoredByMe: true },
          createdAt: NOW - 5 * DAY
        }).lastActivityAt
      ).toBe(NOW - 5 * DAY);
    });
  });

  describe('assigned to me', () => {
    it('includes an open PR assigned to me even with no comment or mention', () => {
      expect(
        score({ involvement: { ...NOBODY, assignedToMe: true } }).include
      ).toBe(true);
    });

    // A merged PR needs nothing from me, however it was assigned.
    it('excludes a completed PR that was assigned to me', () => {
      expect(
        score({
          status: 'completed',
          involvement: { ...NOBODY, assignedToMe: true },
          closedAt: NOW - 2 * DAY
        }).include
      ).toBe(false);
    });
  });

  it('treats the window boundary as inside', () => {
    expect(
      score({
        status: 'completed',
        involvement: { ...NOBODY, commentedByMe: true },
        closedAt: NOW - 60 * DAY,
        lastCommentedAt: NOW - ACTIVITY_WINDOW_MS
      }).include
    ).toBe(true);
  });
});

describe('mentionsIdentity', () => {
  const me = {
    id: 'ea65b156-52af-6953-9838-0039bb53ad32',
    displayName: 'Dev User'
  };

  it('matches the raw guid form Azure DevOps stores', () => {
    expect(mentionsIdentity(`hey @${me.id} please look`, me)).toBe(true);
  });

  it('matches a plain @display-name mention', () => {
    expect(mentionsIdentity('cc @Dev User', me)).toBe(true);
  });

  it('ignores an unrelated identity', () => {
    expect(
      mentionsIdentity('@11111111-2222-3333-4444-555555555555 ping', me)
    ).toBe(false);
  });

  // npm scopes and CodeRabbit output are full of @ signs.
  it('ignores incidental at-signs', () => {
    expect(mentionsIdentity('bump `@scope/pkg@1.2.3-rc.2`', me)).toBe(false);
    expect(mentionsIdentity('summarize by coderabbit.ai', me)).toBe(false);
  });

  it('tolerates non-string content', () => {
    expect(mentionsIdentity(undefined, me)).toBe(false);
    expect(mentionsIdentity(42, me)).toBe(false);
  });

  it('does not match a display name when there is none', () => {
    expect(mentionsIdentity('@ someone', { id: 'x', displayName: '' })).toBe(
      false
    );
  });
});

describe('isAssignedTo', () => {
  const ME = 'ea65b156-52af-6953-9838-0039bb53ad32';

  it('detects me among the reviewers', () => {
    expect(isAssignedTo([{ id: 'other' }, { id: ME }], ME)).toBe(true);
  });

  it('is false when I am not a reviewer', () => {
    expect(isAssignedTo([{ id: 'other' }], ME)).toBe(false);
  });

  it('tolerates malformed reviewers', () => {
    expect(isAssignedTo(undefined, ME)).toBe(false);
    expect(isAssignedTo([null, 7, {}], ME)).toBe(false);
  });
});

describe('activityRank', () => {
  const open = (involvement: Partial<typeof NOBODY> = {}) => ({
    status: 'active' as const,
    involvement: { ...NOBODY, ...involvement }
  });

  // Someone is waiting on my review, so these lead the list.
  it('ranks an open PR assigned to me first', () => {
    expect(activityRank(open({ assignedToMe: true }))).toBe(0);
  });

  it('ranks other open PRs after those', () => {
    expect(activityRank(open({ authoredByMe: true }))).toBe(1);
  });

  it('ranks closed and abandoned PRs last', () => {
    expect(
      activityRank({
        status: 'completed',
        involvement: { ...NOBODY, assignedToMe: true }
      })
    ).toBe(2);
    expect(
      activityRank({
        status: 'abandoned',
        involvement: { ...NOBODY, assignedToMe: true }
      })
    ).toBe(2);
  });

  it('orders a mixed list assigned-open, open, closed', () => {
    const items = [
      {
        status: 'completed' as const,
        involvement: { ...NOBODY, authoredByMe: true }
      },
      open({ authoredByMe: true }),
      open({ assignedToMe: true })
    ];
    expect(
      [...items].sort((a, b) => activityRank(a) - activityRank(b))
    ).toEqual([
      open({ assignedToMe: true }),
      open({ authoredByMe: true }),
      { status: 'completed', involvement: { ...NOBODY, authoredByMe: true } }
    ]);
  });
});
