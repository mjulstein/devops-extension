import {
  buildRepliesWiql,
  evaluateThread,
  excerpt,
  pruneSeen,
  sortReplies,
  unseen,
  type Reply,
  type ReplyThread,
  type ThreadComment
} from './replies';
import { parsePullRequestThreads, parseWorkItemComments } from './repliesApi';

const ME = { id: 'me-guid', displayName: 'Me Person', uniqueName: 'me@x' };
const SINCE = '2026-11-01T00:00:00Z';

function c(author: string, at: string, content = 'hi'): ThreadComment {
  return {
    authorId: author === 'me' ? 'me-guid' : `${author}-guid`,
    authorName: author === 'me' ? 'Me Person' : author,
    authorUniqueName: '',
    content,
    at
  };
}

function thread(comments: ThreadComment[]): ReplyThread {
  return { key: 'k', title: 'T', url: 'u', comments };
}

describe('evaluateThread', () => {
  it('counts someone writing after my last comment', () => {
    const r = evaluateThread(
      thread([c('me', '2026-11-10'), c('Ann', '2026-11-11', 'done?')]),
      ME,
      SINCE
    );
    expect(r).toMatchObject({
      lastAuthor: 'Ann',
      excerpt: 'done?',
      mention: false
    });
  });

  it('ignores a thread whose last word is mine', () => {
    expect(
      evaluateThread(
        thread([c('Ann', '2026-11-10'), c('me', '2026-11-11')]),
        ME,
        SINCE
      )
    ).toBeNull();
  });

  it('ignores a thread I never joined and was not mentioned in', () => {
    expect(
      evaluateThread(thread([c('Ann', '2026-11-10')]), ME, SINCE)
    ).toBeNull();
  });

  it('flags an unanswered mention', () => {
    const r = evaluateThread(
      thread([c('Ann', '2026-11-10', 'ping @<me-guid>')]),
      ME,
      SINCE
    );
    expect(r?.mention).toBe(true);
    expect(r?.excerpt).toBe('ping @someone');
  });

  it('drops a mention I answered', () => {
    expect(
      evaluateThread(
        thread([c('Ann', '2026-11-10', '@Me Person?'), c('me', '2026-11-11')]),
        ME,
        SINCE
      )
    ).toBeNull();
  });

  it('ignores replies older than the window', () => {
    expect(
      evaluateThread(
        thread([c('me', '2026-10-01'), c('Ann', '2026-10-02')]),
        ME,
        SINCE
      )
    ).toBeNull();
  });

  it('matches a name-only identity', () => {
    const who = { id: '', displayName: 'Me Person', uniqueName: 'me@x' };
    expect(
      evaluateThread(
        thread([c('me', '2026-11-10'), c('Ann', '2026-11-11')]),
        who,
        SINCE
      )
    ).not.toBeNull();
  });
});

describe('excerpt', () => {
  it('takes the first line of HTML as text', () => {
    expect(excerpt('<div><p></p><p>Hello &amp; bye</p><p>more</p></div>')).toBe(
      'Hello & bye'
    );
  });
});

const reply = (key: string, lastAt: string, mention = false): Reply => ({
  key,
  title: key,
  url: '',
  lastAuthor: '',
  lastAt,
  excerpt: '',
  mention
});

describe('sortReplies / seen', () => {
  it('puts mentions first, then newest', () => {
    const sorted = sortReplies([
      reply('a', '1'),
      reply('b', '2'),
      reply('m', '0', true)
    ]);
    expect(sorted.map((r) => r.key)).toEqual(['m', 'b', 'a']);
  });

  it('hides a seen thread until something newer arrives', () => {
    expect(unseen([reply('a', '2026-11-10')], { a: '2026-11-10' })).toEqual([]);
    expect(
      unseen([reply('a', '2026-11-12')], { a: '2026-11-10' })
    ).toHaveLength(1);
  });

  it('prunes old marks', () => {
    expect(pruneSeen({ a: '2026-10-01', b: '2026-11-05' }, SINCE)).toEqual({
      b: '2026-11-05'
    });
  });
});

describe('buildRepliesWiql', () => {
  it('uses the mention macros for the signed-in user', () => {
    expect(buildRepliesWiql('', '2026-11-01')).toContain('@RecentMentions');
  });

  it('uses ChangedBy for an override, quoting it', () => {
    expect(buildRepliesWiql("o'neil", '2026-11-01')).toContain(
      "EVER 'o''neil'"
    );
  });
});

describe('parsePullRequestThreads', () => {
  it('keeps open threads, drops system comments, never writes "!"', () => {
    const threads = parsePullRequestThreads(
      {
        value: [
          {
            id: 7,
            status: 'active',
            comments: [
              {
                author: { id: 'x', displayName: 'X' },
                content: 'a',
                publishedDate: '1'
              },
              { commentType: 'system', content: 'voted', publishedDate: '2' }
            ]
          },
          { id: 8, status: 'fixed', comments: [] },
          { id: 9, comments: [] }
        ]
      },
      { id: 45, title: 'Fix', url: 'https://pr' }
    );
    expect(threads).toHaveLength(1);
    expect(threads[0].title).toBe('PR 45: Fix');
    expect(threads[0].url).toBe('https://pr?_a=overview&discussionId=7');
    expect(threads[0].comments).toHaveLength(1);
  });
});

describe('parseWorkItemComments', () => {
  it('reads the discussion as one thread', () => {
    const t = parseWorkItemComments(
      {
        comments: [
          {
            createdBy: { id: 'x', displayName: 'X' },
            text: '<p>hi</p>',
            createdDate: '1'
          },
          { isDeleted: true, text: 'gone', createdDate: '2' }
        ]
      },
      { id: 3, title: 'Item', url: 'u' }
    );
    expect(t.key).toBe('wi:3');
    expect(t.comments).toHaveLength(1);
  });
});
